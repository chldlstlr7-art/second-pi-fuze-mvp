document.addEventListener('DOMContentLoaded', () => {
    // ... (same as before)
});

function setupFileHandling({ dropArea, fileInput, fileNameDisplay, ideaTextarea, spinner }) {
    // ... (same as before)
}

let originalIdea = '', aiQuestions = [], fusionResultForCopy = '';
const stages = { /* ... */ };
const steps = { /* ... */ };
const spinner = document.getElementById('loading-spinner');

// ... (event listeners and UI functions are the same) ...

async function callApi(body) {
    // ... (same as before)
}

async function handleAnalysisRequest() {
    originalIdea = document.getElementById('idea-input').value.trim();
    if (!originalIdea) return alert('아이디어를 입력해주세요.');
    
    finalizeStage('input');
    
    // Call for the main analysis report
    const data = await callApi({ stage: 'analyze', idea: originalIdea });
    
    if (data) {
        renderAnalysisReport(data);
        revealStage('analysis');
        // As soon as the report is shown, start generating questions in the background
        handleQuestionGenerationInBackground();
    }
}

async function handleQuestionGenerationInBackground() {
    const btn = document.getElementById('btn-show-questions-dynamic');
    if (!btn) return;

    // Call API to generate questions
    const data = await callApi({ stage: 'generate_questions', idea: originalIdea });

    if (data && data.questions) {
        aiQuestions = data.questions;
        renderQuestionInputs(aiQuestions); // Pre-render the questions in the hidden div
        btn.textContent = '질문에 답변하기';
        btn.disabled = false;
    } else {
        // Handle failure to generate questions
        btn.textContent = '질문 생성 실패 (클릭하여 재시도)';
        btn.disabled = false;
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

function renderAnalysisReport(data) {
    const { logicalOriginalityScore, textPlagiarismScore, coreSummary, judgmentCriteria, plagiarismReport, documentType } = data;
    const analysisStage = stages.analysis;

    let criteriaHTML = (judgmentCriteria || []).map(item => `<li>${item}</li>`).join('');

    let reportHTML = `
        <h2>1. 독창성 진단 리포트 <span style="font-size: 0.6em; color: var(--text-light); font-weight: 500;">(분석 유형: ${documentType})</span></h2>
        <div class="analysis-section">
            <h3>핵심 요약</h3>
            <ol id="core-summary-list">${(coreSummary || []).map(item => `<li>${item}</li>`).join('')}</ol>
        </div>
        <div class="analysis-section">
            <h3>종합 평가 지표</h3>
            <div class="gauges-grid">
                <div class="gauge-container">
                    <h4>논리 구조적 독창성</h4>
                    <svg width="200" height="120" viewBox="0 0 200 120">
                        <defs><linearGradient id="logicalGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#D0021B"/><stop offset="50%" stop-color="#F8E71C"/><stop offset="100%" stop-color="#50E3C2"/></linearGradient></defs>
                        <path d="M 20 100 A 80 80 0 0 1 180 100" stroke="#EAECEF" stroke-width="20" fill="none" />
                        <path id="logical-gauge-arc" d="M 20 100 A 80 80 0 0 1 180 100" stroke="url(#logicalGaugeGradient)" stroke-width="20" fill="none" stroke-linecap="round" style="stroke-dasharray: 251.3; stroke-dashoffset: 251.3; transition: stroke-dashoffset 1.2s ease-in-out;"/>
                        <text id="logical-gauge-text" x="100" y="95" text-anchor="middle" font-size="28px" font-weight="bold">0%</text>
                    </svg>
                </div>
                <div class="gauge-container">
                    <h4>텍스트 표절률</h4>
                    <svg width="200" height="120" viewBox="0 0 200 120">
                        <defs><linearGradient id="textGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#50E3C2"/><stop offset="50%" stop-color="#F8E71C"/><stop offset="100%" stop-color="#D0021B"/></linearGradient></defs>
                        <path d="M 20 100 A 80 80 0 0 1 180 100" stroke="#EAECEF" stroke-width="20" fill="none" />
                        <path id="text-gauge-arc" d="M 20 100 A 80 80 0 0 1 180 100" stroke="url(#textGaugeGradient)" stroke-width="20" fill="none" stroke-linecap="round" style="stroke-dasharray: 251.3; stroke-dashoffset: 251.3; transition: stroke-dashoffset 1.2s ease-in-out;"/>
                        <text id="text-gauge-text" x="100" y="95" text-anchor="middle" font-size="28px" font-weight="bold">0%</text>
                    </svg>
                </div>
            </div>
        </div>
        <div class="analysis-section">
            <h3>판단 기준</h3>
            <ul class="criteria-list">${criteriaHTML}</ul>
        </div>
        <div class="analysis-section">
            <h3>표절 검사 상세 리포트</h3>
            <div id="plagiarism-report-container"></div>
        </div>
        <button id="btn-show-questions-dynamic" disabled>질문 생성 중...</button>`;

    analysisStage.innerHTML = reportHTML;
    
    document.getElementById('btn-show-questions-dynamic').addEventListener('click', () => {
        if(aiQuestions.length > 0) {
            revealStage('questions');
        } else {
            // If user clicks while questions are still generating (or failed), retry
            handleQuestionGenerationInBackground();
        }
    });

    // Animate Gauges and Render Plagiarism Report (code is the same as previous full version)
    // ...
}

// ... (rest of the file is the same)

