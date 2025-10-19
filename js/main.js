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

// --- (수정) 다중 파일 병렬 분석 요청 핸들러 (스켈레톤 로더 적용) ---
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

        // 1. 스켈레톤 로더 플레이스홀더 생성
        const placeholderHtml = `
            <div id="${fileId}" class="card">
                <h2>${escapeHTML(file.name)}</h2>

                <div id="eval-${fileId}" class="skeleton-wrapper">
                    <div class="skeleton skeleton-title" style="width: 50%;"></div>
                    <div class="skeleton-eval-container">
                        <div class="skeleton skeleton-circle"></div>
                        <div class="skeleton-eval-text">
                            <div class="skeleton skeleton-line"></div>
                            <div class="skeleton skeleton-line" style="width: 70%;"></div>
                        </div>
                    </div>
                </div>

                <div id="summary-${fileId}" class="skeleton-wrapper">
                    <div class="skeleton skeleton-title" style="width: 30%;"></div>
                    <div class="skeleton skeleton-line"></div>
                    <div class="skeleton skeleton-line"></div>
                    <div class="skeleton skeleton-line" style="width: 80%;"></div>
                </div>

                <div id="sim-${fileId}" class="skeleton-wrapper">
                    <div class="skeleton skeleton-title" style="width: 60%;"></div>
                    <div class="skeleton skeleton-line"></div>
                    <div class="skeleton skeleton-line" style="width: 90%;"></div>
                    <div class="skeleton skeleton-line" style="margin-top: 20px;"></div>
                    <div class="skeleton skeleton-line" style="width: 75%;"></div>
                </div>
            </div>
        `;
        resultStage.insertAdjacentHTML('beforeend', placeholderHtml);

        // 2. 비동기(await 없음)로 3개 API 동시 호출 및 개별 업데이트
        callApiEndpoint('/api/ta-summary', { stage: 'summarize', reportText: file.text })
            .then(data => {
                document.getElementById(`summary-${fileId}`).outerHTML = renderSummaryHtml(data); // outerHTML로 교체
            })
            .catch(error => {
                document.getElementById(`summary-${fileId}`).outerHTML = renderErrorHtml("핵심 요약", error.message); // outerHTML로 교체
            });

        callApiEndpoint('/api/ta-evaluate', { stage: 'evaluate', reportText: file.text })
            .then(data => {
                document.getElementById(`eval-${fileId}`).outerHTML = renderEvaluationHtml(data); // outerHTML로 교체
            })
            .catch(error => {
                document.getElementById(`eval-${fileId}`).outerHTML = renderErrorHtml("종합 점수 및 평가", error.message); // outerHTML로 교체
            });

        callApiEndpoint('/api/ta-similarity', { stage: 'check_similarity', reportText: file.text })
            .then(data => {
                document.getElementById(`sim-${fileId}`).outerHTML = renderSimilarityHtml(data); // outerHTML로 교체
            })
            .catch(error => {
                document.getElementById(`sim-${fileId}`).outerHTML = renderErrorHtml("유사성 검토", error.message); // outerHTML로 교체
            });
    }
}
