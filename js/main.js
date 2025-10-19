// --- 글로벌 상태 ---
let filesToAnalyze = [];

// --- DOM Elements ---
const inputStage = document.getElementById('stage-input');
const resultStage = document.getElementById('stage-result');
const btnStart = document.getElementById('btn-start-assessment');
const btnRestart = document.getElementById('btn-restart');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileListElement = document.getElementById('file-list'); // 이름 변경 (fileList -> fileListElement)

// --- 이벤트 리스너 ---
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
    // handleFileSelect를 호출하고 결과를 filesToAnalyze에 할당
    filesToAnalyze = await handleFileSelect(fileInput, fileListElement, filesToAnalyze);
});
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        // handleFileSelect를 호출하고 결과를 filesToAnalyze에 할당
        filesToAnalyze = await handleFileSelect(fileInput, fileListElement, filesToAnalyze);
    }
});

btnStart.addEventListener('click', handleAssessmentRequest);
btnRestart.addEventListener('click', () => location.reload());

// --- 메인 분석 요청 핸들러 ---
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

        const placeholderHtml = `
            <div id="${fileId}" class="card">
                <h2>${escapeHTML(file.name)}</h2>
                <div id="eval-${fileId}" class="report-section-placeholder">
                    <h3>종합 점수 및 평가</h3><div class="spinner-small"></div>
                </div>
                <div id="summary-${fileId}" class="report-section-placeholder">
                    <h3>핵심 요약</h3><div class="spinner-small"></div>
                </div>
                <div id="sim-${fileId}" class="report-section-placeholder">
                    <h3 style="color: #D97706;">유사성 검토 항목 (참고)</h3><div class="spinner-small"></div>
                </div>
            </div>`;
        resultStage.insertAdjacentHTML('beforeend', placeholderHtml);

        // API 호출 및 결과 렌더링
        callApiEndpoint('/api/ta-summary', { stage: 'summarize', reportText: file.text })
            .then(data => { document.getElementById(`summary-${fileId}`).innerHTML = renderSummaryHtml(data); })
            .catch(error => { document.getElementById(`summary-${fileId}`).innerHTML = renderErrorHtml("핵심 요약", error.message); });

        callApiEndpoint('/api/ta-evaluate', { stage: 'evaluate', reportText: file.text })
            .then(data => { document.getElementById(`eval-${fileId}`).innerHTML = renderEvaluationHtml(data); })
            .catch(error => { document.getElementById(`eval-${fileId}`).innerHTML = renderErrorHtml("종합 점수 및 평가", error.message); });

        callApiEndpoint('/api/ta-similarity', { stage: 'check_similarity', reportText: file.text })
            .then(data => { document.getElementById(`sim-${fileId}`).innerHTML = renderSimilarityHtml(data); })
            .catch(error => { document.getElementById(`sim-${fileId}`).innerHTML = renderErrorHtml("유사성 검토", error.message); });
    }
}
