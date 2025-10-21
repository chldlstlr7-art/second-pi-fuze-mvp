document.addEventListener('DOMContentLoaded', () => {
    // 1. Check for user login status from localStorage
    const userData = localStorage.getItem('pi-fuze-user');
    if (!userData) {
        handleError("로그인이 필요합니다.", false);
        setTimeout(() => window.location.href = '/', 2000);
        return;
    }
    const user = JSON.parse(userData);
    document.getElementById('welcome-message').textContent = `${user.userName}님, 환영합니다!`;
    
    // 2. Setup all event listeners for the page
    initializeEventListeners();

    // 3. Setup file handling (drag & drop, click to upload)
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
}

// --- File Handling ---
function setupFileHandling({ dropArea, fileInput, fileNameDisplay, ideaTextarea, spinner }) {
    // ... (This section is correct and remains unchanged)
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
    // ... (This section is correct and remains unchanged)
}

// --- API Call Function ---
async function callApi(body) {
    // ... (This section is correct and remains unchanged)
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

// --- Rendering Functions (FIXED) ---
function renderAnalysisReport(data) {
    const { documentType, coreSummary, logicFlowchart, structuralComparison, plagiarismReport } = data;
    
    // Populate static elements first
    document.getElementById('analysis-doc-type').textContent = `(분석 유형: ${documentType || '알 수 없음'})`;
    document.getElementById('core-summary-list').innerHTML = (coreSummary || []).map(item => `<li>${item}</li>`).join('');
    document.getElementById('logic-flowchart').innerHTML = (logicFlowchart || "").split('->').map(item => `<div class="flowchart-item">${item.trim()}</div>`).join('');

    const textPlagiarismScore = calculateTextPlagiarismScore(plagiarismReport?.plagiarismSuspicion);
    const logicalOriginalityScore = 100 - Math.round((structuralComparison?.topicalSimilarity * 0.4 || 0) + (structuralComparison?.structuralSimilarity * 0.6 || 0));

    const reasoningEl = document.getElementById('originality-reasoning-text');
    if (reasoningEl) {
        reasoningEl.textContent = structuralComparison?.originalityReasoning || "분석 코멘트가 없습니다.";
    }

    animateGauge('logical-gauge-arc', 'logical-gauge-text', logicalOriginalityScore);
    animateGauge('text-gauge-arc', 'text-gauge-text', textPlagiarismScore, true);

    const reportContainer = document.getElementById('plagiarism-report-container');
    reportContainer.innerHTML = '';
    let hasContent = false;

    if (structuralComparison && structuralComparison.sourceName) {
        hasContent = true;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'report-item structural';
        itemDiv.innerHTML = `<h4>구조적 유사성</h4><p><strong>유사사례:</strong> ${structuralComparison.sourceName}</p><p><strong>유사 논리 구조:</strong> ${structuralComparison.sourceLogic}</p><p><strong>구조 일치율:</strong> ${structuralComparison.structuralSimilarity || 0}%</p><div class="similarity-bar-container"><div class="similarity-bar" style="width: ${structuralComparison.structuralSimilarity || 0}%;"></div></div><p style="margin-top: 10px;"><strong>유사 지점:</strong> ${structuralComparison.pointOfSimilarity}</p>`;
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

    // Re-enable and re-attach listener for the questions button
    const questionsButton = document.getElementById('btn-show-questions');
    questionsButton.disabled = false;
    questionsButton.onclick = () => revealStage('questions'); // Simple re-attachment
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
    
    let editsForCopy = (suggestedEdits && suggestedEdits.length > 0)
        ? suggestedEdits.map((edit, i) => `\n[수정 제안 #${i+1}]\n- 원본: ${edit.originalText}\n- 제안: ${edit.suggestedRevision}`).join('\n')
        : '';
    fusionResultForCopy = `## 최종 제안: ${fusionTitle}\n\n**핵심 분석**\n- 기존 내용: ${analysis.originalSummary}\n- 변경점: ${analysis.keyChange}\n- 결론: ${analysis.conclusion}\n${editsForCopy}`;
}

function handleCopyResult() {
    navigator.clipboard.writeText(fusionResultForCopy).then(() => {
        const btn = document.getElementById('btn-copy-result');
        btn.textContent = '복사 완료!';
        setTimeout(() => { btn.textContent = '결과 텍스트로 복사'; }, 2000);
    });
}

function handleFeedback(isHelpful) {
    document.getElementById('feedback-message').textContent = '피드백을 주셔서 감사합니다!';
    document.getElementById('btn-feedback-yes').disabled = true;
    document.getElementById('btn-feedback-no').disabled = true;
}

function animateValue(obj, start, end, duration) {
    if (!obj) return;
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

