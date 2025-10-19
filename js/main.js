// js/main.js

// --- 글로벌 상태 ---
let filesToAnalyze = [];

// --- DOM Elements ---
const inputStage = document.getElementById('stage-input');
const resultStage = document.getElementById('stage-result');
const btnStart = document.getElementById('btn-start-assessment');
const btnRestart = document.getElementById('btn-restart');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileListElement = document.getElementById('file-list');

// --- 이벤트 리스너 ---
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
    filesToAnalyze = await handleFileSelect(fileInput, fileListElement, filesToAnalyze);
});
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        filesToAnalyze = await handleFileSelect(fileInput, fileListElement, filesToAnalyze);
    }
});

btnStart.addEventListener('click', handleAssessmentRequest);
btnRestart.addEventListener('click', () => location.reload());

// --- 다중 파일 병렬 분석 요청 핸들러 ---
async function handleAssessmentRequest() {
    const validFiles = filesToAnalyze.filter(f => !f.error && f.text);

    if (validFiles.length === 0) {
        alert('분석할 유효한 파일이 없습니다. .pdf 또는 .docx 파일을 업로드해주세요.');
        return;
    }

    inputStage.classList.add('hidden');
    resultStage.classList.remove('hidden');
    resultStage.innerHTML = '';
    btnRestart.classList.remove('hidden');
    btnStart.disabled = true;

    for (const file of validFiles) {
        const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const evalId = `eval-${fileId}`;
        const summaryId = `summary-${fileId}`;
        const simId = `sim-${fileId}`;

        // 1. 아코디언 구조 + 스켈레톤 로더 플레이스홀더 생성 (수정: 주석 제거, 제목 변경)
        const placeholderHtml = `
            <div id="${fileId}" class="card">
                <h2><span id="status-${fileId}" class="status-icon">⏳</span> ${escapeHTML(file.name)}</h2>

                {/* --- 수정: open 옆 주석 제거 --- */}
                <div class="accordion-item open">
                    <div class="accordion-header" onclick="toggleAccordion(this)">
                        <h3 class="accordion-title eval-title"><span class="section-icon">📊</span> 종합 점수 및 평가</h3>
                        <span class="accordion-toggle">▲</span>
                    </div>
                    <div class="accordion-content" id="${evalId}">
                        <div class="skeleton-wrapper">
                            <div class="skeleton-eval-container">
                                <div class="skeleton skeleton-circle"></div>
                                <div class="skeleton-eval-text">
                                    <div class="skeleton skeleton-line"></div>
                                    <div class="skeleton skeleton-line" style="width: 70%;"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="accordion-item">
                     <div class="accordion-header" onclick="toggleAccordion(this)">
                        <h3 class="accordion-title summary-title"><span class="section-icon">📝</span> 핵심 요약</h3>
                        <span class="accordion-toggle">▼</span>
                    </div>
                    <div class="accordion-content" id="${summaryId}">
                        <div class="skeleton-wrapper">
                            <div class="skeleton skeleton-line"></div>
                            <div class="skeleton skeleton-line"></div>
                            <div class="skeleton skeleton-line" style="width: 80%;"></div>
                        </div>
                    </div>
                </div>

                <div class="accordion-item">
                     <div class="accordion-header" onclick="toggleAccordion(this)">
                        {/* --- 수정: 유사성 -> 표절 검사 --- */}
                        <h3 class="accordion-title similarity-title" style="color: var(--warning-dark);"><span class="section-icon">⚠️</span> 표절 검사 상세 리포트</h3>
                        <span class="accordion-toggle">▼</span>
                    </div>
                    <div class="accordion-content" id="${simId}">
                         <div class="skeleton-wrapper">
                            <div class="skeleton skeleton-title" style="width: 60%; height: 20px;"></div>
                            <div class="skeleton skeleton-line"></div>
                            <div class="skeleton skeleton-line" style="width: 90%;"></div>
                            <div class="skeleton skeleton-line" style="margin-top: 20px;"></div>
                            <div class="skeleton skeleton-line" style="width: 75%;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        resultStage.insertAdjacentHTML('beforeend', placeholderHtml);

        // 2. 비동기(Promise.allSettled)로 3개 API 동시 호출 및 개별 업데이트
        Promise.allSettled([
            callApiEndpoint('/api/ta-summary', { stage: 'summarize', reportText: file.text }),
            callApiEndpoint('/api/ta-evaluate', { stage: 'evaluate', reportText: file.text }),
            callApiEndpoint('/api/ta-similarity', { stage: 'check_similarity', reportText: file.text })
        ]).then(results => {
            // 모든 API 호출 완료 후 상태 아이콘 업데이트
            const statusIcon = document.getElementById(`status-${fileId}`);
            const hasError = results.some(result => result.status === 'rejected');
            if (statusIcon) {
                if (hasError) {
                    statusIcon.textContent = '❌';
                    statusIcon.style.color = 'var(--danger-color)';
                } else {
                    statusIcon.textContent = '✅';
                    statusIcon.style.color = 'var(--primary-color)';
                }
            }

            // 개별 섹션 업데이트 (성공/실패 분기)
            const summaryResult = results[0];
            const evalResult = results[1];
            const simResult = results[2];
            const summaryElement = document.getElementById(summaryId);
            const evalElement = document.getElementById(evalId);
            const simElement = document.getElementById(simId);

            if (summaryElement) {
                summaryElement.innerHTML = summaryResult.status === 'fulfilled'
                    ? renderSummaryHtml(summaryResult.value)
                    : renderErrorHtml("핵심 요약", summaryResult.reason.message);
            }
            if (evalElement) {
                evalElement.innerHTML = evalResult.status === 'fulfilled'
                    ? renderEvaluationHtml(evalResult.value)
                    : renderErrorHtml("종합 점수 및 평가", evalResult.reason.message);
            }
            if (simElement) {
                // (수정) 표절 검사 제목 전달
                simElement.innerHTML = simResult.status === 'fulfilled'
                    ? renderSimilarityHtml(simResult.value)
                    : renderErrorHtml("표절 검사 상세 리포트", simResult.reason.message);
            }
        });
    }
}

// --- 아코디언 토글 함수 ---
function toggleAccordion(headerElement) {
    const item = headerElement.closest('.accordion-item');
    const content = item.querySelector('.accordion-content');
    const toggle = headerElement.querySelector('.accordion-toggle');

    if (item.classList.contains('open')) {
        item.classList.remove('open');
        toggle.textContent = '▼';
    } else {
        // Optional: Close other accordions in the same card when one opens
        // const parentCard = item.closest('.card');
        // if (parentCard) {
        //     parentCard.querySelectorAll('.accordion-item.open').forEach(openItem => {
        //         if (openItem !== item) {
        //             openItem.classList.remove('open');
        //             openItem.querySelector('.accordion-toggle').textContent = '▼';
        //         }
        //     });
        // }
        item.classList.add('open');
        toggle.textContent = '▲';
    }
}
