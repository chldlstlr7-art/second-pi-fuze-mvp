document.addEventListener('DOMContentLoaded', () => {
    const userData = localStorage.getItem('pi-fuze-user');
    if (!userData) {
        handleError("로그인이 필요합니다.", false);
        setTimeout(() => window.location.href = '/', 2000);
        return;
    }
    const user = JSON.parse(userData);
    document.getElementById('welcome-message').textContent = `${user.userName}님, 환영합니다!`;
    
    const fileHandlingElements = {
        dropArea: document.getElementById('file-drop-area'),
        fileInput: document.getElementById('file-upload'),
        fileNameDisplay: document.getElementById('file-name'),
        ideaTextarea: document.getElementById('idea-input'),
        spinner: document.getElementById('loading-spinner')
    };
    setupFileHandling(fileHandlingElements);
});

function setupFileHandling({ dropArea, fileInput, fileNameDisplay, ideaTextarea, spinner }) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
        document.body.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false));
    ['dragleave', 'drop'].forEach(eventName => dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false));
    
    dropArea.addEventListener('drop', e => handleFiles(e.dataTransfer.files), false);
    dropArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => handleFiles(e.target.files));

    async function handleFiles(files) {
        if (files.length > 1) { return alert("하나의 파일만 업로드할 수 있습니다."); }
        const file = files[0];
        const validTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!validTypes.includes(file.type)) { return alert("허용된 파일 형식이 아닙니다. (.txt, .pdf, .docx)"); }

        fileNameDisplay.textContent = `파일 처리 중: ${file.name}`;
        spinner.classList.remove('hidden');
        ideaTextarea.value = '';

        try {
            let text = '';
            if (file.type === 'text/plain') { text = await file.text(); } 
            else if (file.type === 'application/pdf') { text = await extractTextFromPdf(file); } 
            else if (file.type.includes('wordprocessingml')) { text = await extractTextFromDocx(file); }
            
            ideaTextarea.value = text;
            fileNameDisplay.textContent = `파일 로드 완료: ${file.name}`;
        } catch (error) {
            handleError(`파일 처리 실패: ${error.message}`);
            fileNameDisplay.textContent = "";
        } finally {
            spinner.classList.add('hidden');
        }
    }
    
    function extractTextFromDocx(file) { /* ... same as before ... */ }
    async function extractTextFromPdf(file) { /* ... same as before ... */ }
}

let originalIdea = '', aiQuestions = [], fusionResultForCopy = '';
const stages = { /* ... */ };
const steps = { /* ... */ };
const spinner = document.getElementById('loading-spinner');

document.getElementById('btn-start-analysis').addEventListener('click', handleAnalysisRequest);
// ... other event listeners ...

function updateProgressBar(stageName) { /* ... */ }
function revealStage(stageName) { /* ... */ }
function finalizeStage(stageName) { /* ... */ }
function handleError(message, showRetry = true) { /* ... */ }
async function callApi(body) { /* ... */ }

async function handleAnalysisRequest() { /* ... */ }
async function handleFusionRequest() { /* ... */ }

function renderAnalysisReport(data) { /* ... same as before ... */ }
function renderQuestionInputs(questions) { /* ... same as before ... */ }

// --- MODIFIED: renderFusionReport Function ---
function renderFusionReport(data) {
    const { fusionTitle, analysis, suggestedEdits } = data;
    const fusionStage = stages.fusion;

    let diffHTML = (suggestedEdits && suggestedEdits.length > 0) 
        ? suggestedEdits.map((edit, index) => `
            <div class="diff-item">
                <div class="diff-header">수정 제안 #${index + 1}</div>
                <div class="diff-content">
                    <div class="diff-box before">
                        <h4>Before (원본)</h4>
                        <p>${edit.originalText}</p>
                    </div>
                    <div class="diff-box after">
                        <h4>After (AI 제안)</h4>
                        <p>${edit.suggestedRevision}</p>
                    </div>
                </div>
            </div>
        `).join('')
        : '<p>구체적인 수정 제안이 없습니다.</p>';

    let fusionHTML = `
        <h2>3. 최종 제안: ${fusionTitle}</h2>
        <div class="analysis-section">
            <h3>핵심 분석 요약</h3>
            <div class="fusion-analysis-grid">
                <div class="analysis-item">
                    <h4>기존 내용</h4>
                    <p>${analysis.originalSummary}</p>
                </div>
                <div class="analysis-item">
                    <h4>핵심 변경점</h4>
                    <p>${analysis.keyChange}</p>
                </div>
                <div class="analysis-item">
                    <h4>결론</h4>
                    <p>${analysis.conclusion}</p>
                </div>
            </div>
        </div>
        <div class="analysis-section">
            <h3>상세 수정 제안 (Track Changes)</h3>
            <div class="diff-container">${diffHTML}</div>
        </div>
        <div class="action-buttons-container">
            <button id="btn-copy-result-dynamic">결과 텍스트로 복사</button>
            <div class="feedback-section">
                <p>이 제안이 도움이 되었나요?</p>
                <div class="feedback-buttons">
                    <button class="feedback-btn" id="btn-feedback-yes-dynamic">👍</button>
                    <button class="feedback-btn" id="btn-feedback-no-dynamic">👎</button>
                </div>
                <p id="feedback-message" style="color: var(--secondary-color); font-weight: bold; margin-top: 10px;"></p>
            </div>
        </div>
        <button id="btn-restart-dynamic">새로운 아이디어 분석하기</button>`;
    
    fusionStage.innerHTML = fusionHTML;
    
    document.getElementById('btn-copy-result-dynamic').addEventListener('click', handleCopyResult);
    document.getElementById('btn-feedback-yes-dynamic').addEventListener('click', () => handleFeedback(true));
    document.getElementById('btn-feedback-no-dynamic').addEventListener('click', () => handleFeedback(false));
    document.getElementById('btn-restart-dynamic').addEventListener('click', () => location.reload());

    // Update text for copying
    let editsForCopy = (suggestedEdits && suggestedEdits.length > 0)
        ? suggestedEdits.map((edit, i) => `\n[수정 제안 #${i+1}]\n- 원본: ${edit.originalText}\n- 제안: ${edit.suggestedRevision}`).join('\n')
        : '';
    fusionResultForCopy = `## 최종 제안: ${fusionTitle}\n\n**핵심 분석**\n- 기존 내용: ${analysis.originalSummary}\n- 변경점: ${analysis.keyChange}\n- 결론: ${analysis.conclusion}\n${editsForCopy}`;
}

function handleCopyResult() { /* ... */ }
function handleFeedback(isHelpful) { /* ... */ }
function animateValue(obj, start, end, duration) { /* ... */ }

// Helper functions (extractTextFromDocx, extractTextFromPdf) need to be included here as well
function extractTextFromDocx(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            mammoth.extractRawText({ arrayBuffer: event.target.result })
                .then(result => resolve(result.value))
                .catch(reject);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function extractTextFromPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let textContent = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const text = await page.getTextContent();
        textContent += text.items.map(s => s.str).join(' ');
    }
    return textContent;
}
</script>

