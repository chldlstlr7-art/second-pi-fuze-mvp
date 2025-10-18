document.addEventListener('DOMContentLoaded', () => {
    // ... (same as before)
});

function setupFileHandling({ dropArea, fileInput, fileNameDisplay, ideaTextarea, spinner }) {
    // ... (same as before)
}

let originalIdea = '', aiQuestions = [], fusionResultForCopy = '';
// ... (rest of state and DOM elements are the same) ...

// ... (event listeners and UI functions are the same) ...

async function callApi(body) {
    // ... (same as before)
}

async function handleAnalysisRequest() {
    originalIdea = document.getElementById('idea-input').value.trim();
    if (!originalIdea) return alert('아이디어를 입력해주세요.');
    
    finalizeStage('input');
    
    const data = await callApi({ stage: 'analyze', idea: originalIdea });
    
    if (data) {
        renderAnalysisReport(data);
        renderQuestionInputs(data.questions);
        revealStage('analysis');
    }
}

// ... (handleFusionRequest is the same) ...

function renderAnalysisReport(data) {
    const { documentType, coreSummary, logicFlowchart, judgmentCriteria, structuralComparison, plagiarismSuspicion, questions } = data;
    const analysisStage = stages.analysis;

    // --- NEW: Calculate Text Plagiarism Score ---
    let textPlagiarismScore = 0;
    if (plagiarismSuspicion && plagiarismSuspicion.length > 0) {
        const totalSimilarity = plagiarismSuspicion.reduce((acc, item) => acc + item.similarityScore, 0);
        const avgSimilarity = totalSimilarity / plagiarismSuspicion.length;
        const highSimilarityCount = plagiarismSuspicion.filter(item => item.similarityScore >= 90).length;
        textPlagiarismScore = Math.min(100, Math.round((avgSimilarity / 2) + (highSimilarityCount * 15)));
    }
    const logicalOriginalityScore = structuralComparison ? (100 - structuralComparison.similarityScore) : 100;


    let coreSummaryHTML = (coreSummary || []).map(item => `<li>${item}</li>`).join('');
    let flowchartHTML = (logicFlowchart || "").split('->').map(item => `<div class="flowchart-item">${item.trim()}</div>`).join('');

    let reportHTML = `
        <h2>1. 독창성 진단 리포트 <span style="font-size: 0.6em; color: var(--text-light); font-weight: 500;">(분석 유형: ${documentType})</span></h2>
        
        <div class="analysis-section">
            <h3>핵심 주장/내용 요약</h3>
            <ol id="core-summary-list">${coreSummaryHTML}</ol>
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
            <h3>논리 흐름도 분석</h3>
            <div class="flowchart">${flowchartHTML}</div>
        </div>

        <div class="analysis-section">
            <h3>표절 검사 상세 리포트</h3>
            <div id="plagiarism-report-container"></div>
        </div>
        <button id="btn-show-questions-dynamic">질문에 답변하기</button>`;

    analysisStage.innerHTML = reportHTML;
    
    document.getElementById('btn-show-questions-dynamic').addEventListener('click', () => revealStage('questions'));

    // Animate Gauges
    const circumference = 251.3;
    const logicalGaugeArc = document.getElementById('logical-gauge-arc');
    const logicalOffset = circumference - (logicalOriginalityScore / 100) * circumference;
    logicalGaugeArc.style.strokeDashoffset = logicalOffset;
    animateValue(document.getElementById('logical-gauge-text'), 0, logicalOriginalityScore, 1200);

    const textGaugeArc = document.getElementById('text-gauge-arc');
    const textOffset = 251.3 - (textPlagiarismScore / 100) * circumference;
    textGaugeArc.style.strokeDashoffset = textOffset;
    animateValue(document.getElementById('text-gauge-text'), 0, textPlagiarismScore, 1200);

    const reportContainer = document.getElementById('plagiarism-report-container');
    reportContainer.innerHTML = '';
    let hasContent = false;

    if (structuralComparison && structuralComparison.sourceName) {
        hasContent = true;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'report-item structural';
        itemDiv.innerHTML = `
            <h4>구조적 유사성</h4>
            <p><strong>유사사례:</strong> ${structuralComparison.sourceName}</p>
            <p><strong>유사 논리 구조:</strong> ${structuralComparison.sourceLogic}</p>
            <p><strong>핵심 요약 일치율:</strong> ${structuralComparison.similarityScore}%</p>
            <div class="similarity-bar-container"><div class="similarity-bar" style="width: ${structuralComparison.similarityScore}%;"></div></div>
            <p style="margin-top: 10px;"><strong>유사 지점:</strong> ${structuralComparison.pointOfSimilarity}</p>
        `;
        reportContainer.appendChild(itemDiv);
    }

    if (plagiarismSuspicion && plagiarismSuspicion.length > 0) {
        hasContent = true;
        plagiarismSuspicion.sort((a, b) => b.similarityScore - a.similarityScore);
        plagiarismSuspicion.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'report-item textual';
            itemDiv.innerHTML = `
                <h4>텍스트 유사성 ( ${item.similarityScore}% )</h4>
                <p><strong>원본 의심 문장:</strong> "${item.userSentence}"</p>
                <p><strong>출처:</strong> ${item.source}</p>
            `;
            reportContainer.appendChild(itemDiv);
        });
    }

    if (!hasContent) {
        reportContainer.innerHTML = '<p>표절 의심 항목이 발견되지 않았습니다.</p>';
    }
}

// ... (rest of the file is the same)

