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
    // ... (same as before)
}

async function handleFusionRequest() {
    // ... (same as before)
}

function renderAnalysisReport(data) {
    const { documentType, coreSummary, logicFlowchart, structuralComparison, plagiarismReport } = data;
    
    // ... (rest of the initial rendering is the same) ...

    const reportContainer = document.getElementById('plagiarism-report-container');
    reportContainer.innerHTML = '';
    let hasContent = false;

    if (structuralComparison && structuralComparison.sourceName) {
        // ... (structural plagiarism rendering is the same) ...
    }

    if (plagiarismReport && plagiarismReport.plagiarismSuspicion && plagiarismReport.plagiarismSuspicion.length > 0) {
        hasContent = true;
        plagiarismReport.plagiarismSuspicion.sort((a, b) => b.similarityScore - a.similarityScore).forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'report-item textual';
            // --- MODIFIED PART ---
            itemDiv.innerHTML = `
                <h4>텍스트 유사성 (${item.similarityScore}%)</h4>
                <p><strong>내 문장 (유사 의심):</strong> "${item.userSentence}"</p>
                <p><strong>원본 의심 문장 (출처: ${item.source}):</strong> "${item.originalSentence}"</p>
            `;
            // --- END MODIFIED PART ---
            reportContainer.appendChild(itemDiv);
        });
    }

    if (!hasContent) {
        reportContainer.innerHTML = '<p>표절 의심 항목이 발견되지 않았습니다.</p>';
    }
}

function calculateTextPlagiarismScore(plagiarismSuspicion) {
    if (!plagiarismSuspicion || plagiarismSuspicion.length === 0) return 0;
    const totalSimilarity = plagiarismSuspicion.reduce((acc, item) => acc + item.similarityScore, 0);
    const avgSimilarity = totalSimilarity / plagiarismSuspicion.length;
    const highSimilarityCount = plagiarismSuspicion.filter(item => item.similarityScore >= 90).length;
    return Math.min(100, Math.round((avgSimilarity / 2) + (highSimilarityCount * 15)));
}

function renderQuestionInputs(questions) {
    // ... (same as before) ...
}

function renderFusionReport(data) {
    // ... (same as before) ...
}

function handleCopyResult() {
    // ... (same as before) ...
}

function handleFeedback(isHelpful) {
    // ... (same as before) ...
}

function animateValue(obj, start, end, duration) {
    // ... (same as before) ...
}

function animateGauge(arcId, textId, score, isReversed = false) {
    // ... (same as before) ...
}

