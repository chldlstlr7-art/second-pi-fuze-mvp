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
    // ... (same as before)
}

async function handleFusionRequest() {
    // ... (same as before)
}

function renderAnalysisReport(data) {
    const { originalityScore, overallAssessment, judgmentCriteria, plagiarismReport, documentType } = data;
    const analysisStage = stages.analysis;

    let criteriaHTML = (judgmentCriteria || []).map(item => `<li>${item}</li>`).join('');

    let reportHTML = `
        <h2>1. 독창성 진단 리포트 <span style="font-size: 0.6em; color: var(--text-light); font-weight: 500;">(분석 유형: ${documentType})</span></h2>
        <div class="analysis-section">
            <h3>종합 평가</h3>
            <p>${overallAssessment}</p>
        </div>
        <div class="analysis-grid">
            <div class="gauge-container">
                <h3>독창성 점수</h3>
                 <svg width="200" height="120" viewBox="0 0 200 120">
                    <defs><linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#D0021B"/><stop offset="50%" stop-color="#F8E71C"/><stop offset="100%" stop-color="#50E3C2"/></linearGradient></defs><path d="M 20 100 A 80 80 0 0 1 180 100" stroke="#EAECEF" stroke-width="20" fill="none" /><path id="gauge-arc" d="M 20 100 A 80 80 0 0 1 180 100" stroke="url(#gaugeGradient)" stroke-width="20" fill="none" stroke-linecap="round" style="stroke-dasharray: 251.3; stroke-dashoffset: 251.3; transition: stroke-dashoffset 1.2s ease-in-out;"/><text id="gauge-text" x="100" y="95" text-anchor="middle" font-size="28px" font-weight="bold">0%</text>
                </svg>
            </div>
            <div class="criteria-container">
                <h3>판단 기준</h3>
                <ul class="criteria-list">${criteriaHTML}</ul>
            </div>
        </div>
        <div class="analysis-section">
            <h3>표절 검사 상세 리포트</h3>
            <div id="plagiarism-report-container"></div>
        </div>
        <button id="btn-show-questions-dynamic">질문에 답변하기</button>`;

    analysisStage.innerHTML = reportHTML;
    
    document.getElementById('btn-show-questions-dynamic').addEventListener('click', () => revealStage('questions'));

    const gaugeArc = document.getElementById('gauge-arc');
    const circumference = 251.3;
    const offset = circumference - (originalityScore / 100) * circumference;
    gaugeArc.style.strokeDashoffset = offset;
    animateValue(document.getElementById('gauge-text'), 0, originalityScore, 1200);

    const reportContainer = document.getElementById('plagiarism-report-container');
    reportContainer.innerHTML = ''; // Clear previous report

    let hasPlagiarismContent = false;

    if (plagiarismReport.plagiarismSuspicion && plagiarismReport.plagiarismSuspicion.length > 0) {
        hasPlagiarismContent = true;
        plagiarismReport.plagiarismSuspicion.sort((a, b) => b.similarityScore - a.similarityScore);
        const suspicionSection = document.createElement('div');
        suspicionSection.innerHTML = `<h4>표절 의심</h4>`;
        plagiarismReport.plagiarismSuspicion.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'report-item suspicion';
            itemDiv.innerHTML = `
                <p><strong>유사 의심 문장:</strong> "${item.similarSentence}"</p>
                <p><strong>출처:</strong> ${item.source}</p>
                <p><strong>텍스트 유사도:</strong> ${item.similarityScore}%</p>
                <div class="similarity-bar-container"><div class="similarity-bar" style="width: ${item.similarityScore}%; background-color: var(--danger-color);"></div></div>
            `;
            suspicionSection.appendChild(itemDiv);
        });
        reportContainer.appendChild(suspicionSection);
    }

    if (plagiarismReport.properCitation && plagiarismReport.properCitation.length > 0) {
        hasPlagiarismContent = true;
        const citationSection = document.createElement('div');
        citationSection.innerHTML = `<h4 style="margin-top: 30px;">정상 인용</h4>`;
        plagiarismReport.properCitation.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'report-item citation';
            itemDiv.innerHTML = `
                <p><strong>인용된 문장:</strong> "${item.citedSentence}"</p>
                <p><strong>출처 표기:</strong> ${item.source}</p>
            `;
            citationSection.appendChild(itemDiv);
        });
        reportContainer.appendChild(citationSection);
    }
    
    if (plagiarismReport.structuralPlagiarism && plagiarismReport.structuralPlagiarism.length > 0) {
        hasPlagiarismContent = true;
        const levelOrder = { '매우 높음': 6, '높음': 5, '주의': 4, '보통': 3, '낮음': 2, '매우 낮음': 1 };
        plagiarismReport.structuralPlagiarism.sort((a, b) => (levelOrder[b.similarityLevel] || 0) - (levelOrder[a.similarityLevel] || 0));
        
        const structuralSection = document.createElement('div');
        structuralSection.innerHTML = `<h4 style="margin-top: 30px;">구조적 표절 분석</h4>`;
        plagiarismReport.structuralPlagiarism.forEach(item => {
            const levelClass = `level-${item.similarityLevel.replace(' ', '')}`;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'report-item';
            itemDiv.innerHTML = `
                <p><strong>유사도 수준:</strong> <span class="similarity-tag ${levelClass}">${item.similarityLevel}</span></p>
                <p><strong>유사 논리 구조:</strong> ${item.sourceLogic}</p>
                <p><strong>유사 지점:</strong> ${item.pointOfSimilarity}</p>
                <p><strong>참고 링크:</strong> <a href="${item.sourceLink}" target="_blank" rel="noopener noreferrer">${item.sourceLink || '제공된 링크 없음'}</a></p>
            `;
            structuralSection.appendChild(itemDiv);
        });
        reportContainer.appendChild(structuralSection);
    }
    
    // NEW: Toggle for Common Knowledge
    if (plagiarismReport.commonKnowledge && plagiarismReport.commonKnowledge.length > 0) {
        hasPlagiarismContent = true;
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = `일반적 지식/용어 (${plagiarismReport.commonKnowledge.length}개)`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'details-content';

        plagiarismReport.commonKnowledge.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'report-item knowledge';
            itemDiv.innerHTML = `<p>"${item}"</p>`;
            contentDiv.appendChild(itemDiv);
        });

        details.appendChild(summary);
        details.appendChild(contentDiv);
        reportContainer.appendChild(details);
    }
    
    if (!hasPlagiarismContent) {
        reportContainer.innerHTML = '<p>표절 의심 항목이 발견되지 않았습니다.</p>';
    }
}

function renderQuestionInputs(questions) {
    // ... (same as before)
}

function renderFusionReport(data) {
    // ... (same as before)
}

function handleCopyResult() {
    // ... (same as before)
}

function handleFeedback(isHelpful) {
    // ... (same as before)
}

function animateValue(obj, start, end, duration) {
    // ... (same as before)
}



