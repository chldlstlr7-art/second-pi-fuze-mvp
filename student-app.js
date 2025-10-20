document.addEventListener('DOMContentLoaded', () => {
    const userData = localStorage.getItem('pi-fuze-user');
    if (!userData) {
        handleError("로그인이 필요합니다.", false);
        setTimeout(() => window.location.href = '/', 2000);
        return;
    }
    const user = JSON.parse(userData);
    document.getElementById('welcome-message').textContent = `${user.userName}님, 환영합니다!`;
    
    initializeEventListeners();

    const fileHandlingElements = {
        dropArea: document.getElementById('file-drop-area'),
        fileInput: document.getElementById('file-upload'),
        fileNameDisplay: document.getElementById('file-name'),
        ideaTextarea: document.getElementById('idea-input'),
        spinner: document.getElementById('loading-container')
    };
    setupFileHandling(fileHandlingElements);
});

// --- State Management Variables ---
let originalIdea = '';
let aiQuestions = [];
let fusionResultForCopy = '';
let loadingInterval; // For loading text animation

// --- DOM Element References ---
const stages = { 
    input: document.getElementById('stage-input'), 
    analysis: document.getElementById('stage-analysis'), 
    questions: document.getElementById('stage-questions'), 
    fusion: document.getElementById('stage-fusion') 
};
const steps = { 
    1: document.getElementById('step-1'), 
    2: document.getElementById('step-2'), 
    3: document.getElementById('step-3') 
};
const loadingContainer = document.getElementById('loading-container');
const loadingText = document.getElementById('loading-text');

// --- Event Listener Setup ---
function initializeEventListeners() {
    document.getElementById('btn-start-analysis').addEventListener('click', handleAnalysisRequest);
    document.getElementById('btn-retry').addEventListener('click', () => location.reload());
    document.getElementById('btn-show-questions').addEventListener('click', () => revealStage('questions'));
    document.getElementById('btn-submit-answers').addEventListener('click', handleFusionRequest);
    document.getElementById('btn-restart').addEventListener('click', () => location.reload());
    document.getElementById('btn-copy-result').addEventListener('click', handleCopyResult);
    document.getElementById('btn-feedback-yes').addEventListener('click', () => handleFeedback(true));
    document.getElementById('btn-feedback-no').addEventListener('click', () => handleFeedback(false));
}

// --- File Handling ---
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
        loadingContainer.classList.remove('hidden');
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
            loadingContainer.classList.add('hidden');
        }
    }
    
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
}

// --- UI Control Functions ---
function updateProgressBar(stageName) {
    Object.values(steps).forEach(step => step.classList.remove('active'));
    if (stageName === 'analysis') { steps[1].classList.add('active'); }
    else if (stageName === 'questions') { [steps[1], steps[2]].forEach(s => s.classList.add('active')); }
    else if (stageName === 'fusion') { [steps[1], steps[2], steps[3]].forEach(s => s.classList.add('active')); }
}

function revealStage(stageName) {
    Object.values(stages).forEach(stage => stage.classList.add('hidden'));
    const stageElement = stages[stageName];
    if (stageElement) {
        stageElement.classList.remove('hidden');
        stageElement.classList.add('fade-in');
        stageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    updateProgressBar(stageName);
}

function finalizeStage(stageName) {
    const stageElement = stages[stageName];
    if (stageElement) {
        stageElement.classList.add('finalized');
        stageElement.querySelectorAll('button, textarea, select').forEach(el => el.disabled = true);
    }
}

function handleError(message, showRetry = true) {
    const errorContainer = document.getElementById('error-message-container');
    const errorText = document.getElementById('error-text');
    if(errorText) errorText.textContent = message;
    if(errorContainer) errorContainer.classList.remove('hidden');
    
    const btnRetry = document.getElementById('btn-retry');
    if(btnRetry) btnRetry.style.display = showRetry ? 'inline-block' : 'none';
    
    if(errorContainer) errorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if(loadingContainer) loadingContainer.classList.add('hidden');
    clearInterval(loadingInterval);
}

// --- API Call Function ---
async function callApi(body) {
    loadingContainer.classList.remove('hidden');
    loadingContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const messages = ["AI가 문서를 분류 중입니다...", "논리 구조를 분석하고 있습니다...", "표절 검사를 수행 중입니다...", "리포트를 생성 중입니다..."];
    let messageIndex = 0;
    loadingText.textContent = messages[messageIndex];
    loadingInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        loadingText.textContent = messages[messageIndex];
    }, 3000);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); 
    try {
        const response = await fetch('/api/student', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `서버 오류: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            handleError('AI 응답 시간이 너무 오래 걸립니다. 잠시 후 다시 시도해주세요.');
        } else {
            handleError(`분석 중 오류가 발생했습니다: ${error.message}`);
        }
        return null;
    } finally {
        loadingContainer.classList.add('hidden');
        clearInterval(loadingInterval);
    }
}

// --- Main Logic Functions ---
async function handleAnalysisRequest() {
    originalIdea = document.getElementById('idea-input').value.trim();
    if (!originalIdea) return alert('아이디어를 입력해주세요.');
    
    finalizeStage('input');
    const data = await callApi({ stage: 'analyze', idea: originalIdea });
    
    if (data) {
        aiQuestions = data.questions || [];
        renderAnalysisReport(data);
        renderQuestionInputs(aiQuestions);
        revealStage('analysis');
    }
}

async function handleFusionRequest() {
    const userAnswers = aiQuestions.map((_, i) => document.getElementById(`answer-${i}`).value.trim());
    if (userAnswers.some(a => a === '')) return alert('모든 질문에 답변해주세요.');
    
    finalizeStage('analysis');
    finalizeStage('questions');
    
    const data = await callApi({ stage: 'fuse', originalIdea, answers: userAnswers });
    
    if (data) {
        renderFusionReport(data);
        revealStage('fusion');
    }
}

// --- Rendering Functions (MODIFIED) ---
function renderAnalysisReport(data) {
    const { documentType, coreSummary, logicFlowchart, structuralComparison, plagiarismReport } = data;
    
    document.getElementById('analysis-doc-type').textContent = `(분석 유형: ${documentType})`;
    document.getElementById('core-summary-list').innerHTML = (coreSummary || []).map(item => `<li>${item}</li>`).join('');
    document.getElementById('logic-flowchart').innerHTML = (logicFlowchart || "").split('->').map(item => `<div class="flowchart-item">${item.trim()}</div>`).join('');

    const textPlagiarismScore = calculateTextPlagiarismScore(plagiarismReport.plagiarismSuspicion);
    const structuralPlagiarismRate = structuralComparison ? Math.round((structuralComparison.topicalSimilarity * 0.4) + (structuralComparison.structuralSimilarity * 0.6)) : 0;

    const reasoningEl = document.getElementById('originality-reasoning-text');
    if (reasoningEl && structuralComparison) {
        reasoningEl.textContent = structuralComparison.originalityReasoning || "분석 코멘트가 없습니다.";
    }

    // Gauges are now for plagiarism rates (higher is worse)
    animateGauge('logical-gauge-arc', 'logical-gauge-text', structuralPlagiarismRate, true);
    animateGauge('text-gauge-arc', 'text-gauge-text', textPlagiarismScore, true);

    const reportContainer = document.getElementById('plagiarism-report-container');
    reportContainer.innerHTML = '';
    let hasContent = false;

    if (structuralComparison && structuralComparison.sourceName) {
        hasContent = true;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'report-item structural';
        itemDiv.innerHTML = `<h4>구조적 유사성</h4><p><strong>유사사례:</strong> ${structuralComparison.sourceName}</p><p><strong>유사 논리 구조:</strong> ${structuralComparison.sourceLogic}</p><p><strong>구조 일치율:</strong> ${structuralComparison.structuralSimilarity}%</p><div class="similarity-bar-container"><div class="similarity-bar" style="width: ${structuralComparison.structuralSimilarity}%;"></div></div>`;
        reportContainer.appendChild(itemDiv);
    }

    if (plagiarismReport && plagiarismReport.plagiarismSuspicion && plagiarismReport.plagiarismSuspicion.length > 0) {
        hasContent = true;
        const textualSection = document.createElement('div');
        textualSection.innerHTML = `<h4 style="margin-top:30px;">텍스트 유사성</h4>`;
        plagiarismReport.plagiarismSuspicion.sort((a, b) => b.similarityScore - a.similarityScore).forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'report-item textual';
            itemDiv.innerHTML = `<h4>텍스트 유사성 (${item.similarityScore}%)</h4><p><strong>내 문장 (유사 의심):</strong> "${item.userSentence}"</p><p><strong>원본 의심 문장 (출처: ${item.source}):</strong> "${item.originalSentence}"</p>`;
            textualSection.appendChild(itemDiv);
        });
        reportContainer.appendChild(textualSection);
    }

    if (!hasContent) {
        reportContainer.innerHTML = '<p>표절 의심 항목이 발견되지 않았습니다.</p>';
    }

    document.getElementById('btn-show-questions').disabled = false;
}

function calculateTextPlagiarismScore(plagiarismSuspicion) {
    if (!plagiarismSuspicion || plagiarismSuspicion.length === 0) return 0;
    const totalSimilarity = plagiarismSuspicion.reduce((acc, item) => acc + item.similarityScore, 0);
    const avgSimilarity = totalSimilarity / plagiarismSuspicion.length;
    const highSimilarityCount = plagiarismSuspicion.filter(item => item.similarityScore >= 90).length;
    return Math.min(100, Math.round((avgSimilarity / 3) + (highSimilarityCount * 15)));
}

function renderQuestionInputs(questions) {
    const container = document.getElementById('questions-container');
    container.innerHTML = (questions || []).map((q, index) => `
        <div class="question-card">
            <label for="answer-${index}">질문 ${index + 1}: ${q}</label>
            <textarea id="answer-${index}" placeholder="답변을 입력하세요..."></textarea>
        </div>`).join('');
}

function renderFusionReport(data) {
    const { fusionTitle, analysis, suggestedEdits } = data;
    const fusionContentWrapper = document.getElementById('fusion-content-wrapper');

    const diffHTML = (suggestedEdits && suggestedEdits.length > 0) 
        ? suggestedEdits.map((edit, index) => `...`).join('') // Shortened
        : '<p>구체적인 수정 제안이 없습니다.</p>';

    fusionContentWrapper.innerHTML = `
        <div class="analysis-section">
            <h3>핵심 분석 요약: ${fusionTitle}</h3>
            <div class="fusion-analysis-grid">
                <div class="analysis-item original"><h4>기존 내용</h4><p>${analysis.originalSummary}</p></div>
                <div class="analysis-item change"><h4>핵심 변경점</h4><p>${analysis.keyChange}</p></div>
                <div class="analysis-item conclusion"><h4>결론</h4><p>${analysis.conclusion}</p></div>
            </div>
        </div>
        <div class="analysis-section">
            <h3>상세 수정 제안 (Track Changes)</h3>
            <div class="diff-container">${diffHTML}</div>
        </div>`;
    
    fusionResultForCopy = `...`; // Shortened
}

function handleCopyResult() {
    // ... (implementation is correct)
}

function handleFeedback(isHelpful) {
    // ... (implementation is correct)
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.textContent = Math.floor(progress * (end - start) + start) + "%";
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function animateGauge(arcId, textId, score, isReversed = false) {
    const gaugeArc = document.getElementById(arcId);
    const gaugeText = document.getElementById(textId);
    if (!gaugeArc || !gaugeText) return;
    
    const circumference = 251.3;
    const offset = isReversed 
        ? 251.3 - (score / 100) * circumference
        : circumference - (score / 100) * circumference;
    
    gaugeArc.style.strokeDashoffset = offset;
    animateValue(gaugeText, 0, score, 1200);
}

