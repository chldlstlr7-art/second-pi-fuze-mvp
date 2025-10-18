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
        spinner: document.getElementById('loading-spinner')
    };
    setupFileHandling(fileHandlingElements);
});

// --- State Management Variables ---
let originalIdea = '';
let aiQuestions = [];
let fusionResultForCopy = '';

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
const spinner = document.getElementById('loading-spinner');

// --- Event Listener Setup ---
function initializeEventListeners() {
    document.getElementById('btn-start-analysis').addEventListener('click', handleAnalysisRequest);
    document.getElementById('btn-retry').addEventListener('click', () => {
        document.getElementById('error-message-container').classList.add('hidden');
        const inputStage = stages.input;
        inputStage.classList.remove('finalized');
        inputStage.querySelectorAll('button, textarea').forEach(el => el.disabled = false);
        updateProgressBar('input');
        inputStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
    if (stageName === 'analysis') {
        steps[1].classList.add('active');
    } else if (stageName === 'questions') {
        steps[1].classList.add('active');
        steps[2].classList.add('active');
    } else if (stageName === 'fusion') {
        [steps[1], steps[2], steps[3]].forEach(s => s.classList.add('active'));
    }
}

function revealStage(stageName) {
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
    if(spinner) spinner.classList.add('hidden');
}

// --- API Call Function ---
async function callApi(body) {
    spinner.classList.remove('hidden');
    spinner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
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
        spinner.classList.add('hidden');
    }
}

// --- Main Logic Functions ---
async function handleAnalysisRequest() {
    originalIdea = document.getElementById('idea-input').value.trim();
    if (!originalIdea) return alert('아이디어를 입력해주세요.');
    
    finalizeStage('input');
    
    const data = await callApi({ stage: 'analyze', idea: originalIdea });
    
    if (data) {
        renderAnalysisReport(data);
        revealStage('analysis');
        handleQuestionGenerationInBackground(); // Start generating questions in the background
    }
}

async function handleQuestionGenerationInBackground() {
    const btn = document.getElementById('btn-show-questions-dynamic');
    if (!btn) return;

    const data = await callApi({ stage: 'generate_questions', idea: originalIdea });

    if (data && data.questions) {
        aiQuestions = data.questions;
        renderQuestionInputs(aiQuestions); // Pre-render questions
        btn.textContent = '질문에 답변하기';
        btn.disabled = false;
    } else {
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

// --- Rendering Functions ---
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
            handleQuestionGenerationInBackground();
        }
    });

    const logicalGaugeArc = document.getElementById('logical-gauge-arc');
    const textGaugeArc = document.getElementById('text-gauge-arc');
    const circumference = 251.3;

    const logicalOffset = circumference - (logicalOriginalityScore / 100) * circumference;
    logicalGaugeArc.style.strokeDashoffset = logicalOffset;
    animateValue(document.getElementById('logical-gauge-text'), 0, logicalOriginalityScore, 1200);

    const textOffset = 251.3 - (textPlagiarismScore / 100) * circumference;
    textGaugeArc.style.strokeDashoffset = textOffset;
    animateValue(document.getElementById('text-gauge-text'), 0, textPlagiarismScore, 1200);

    const reportContainer = document.getElementById('plagiarism-report-container');
    reportContainer.innerHTML = '';
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
    aiQuestions = questions;
    const questionsStage = stages.questions;
    let questionsHTML = `
        <h2>2. 창의적 도발 질문</h2>
        <p>AI가 제안한 아래 질문들에 답변하며 글을 발전시켜 보세요.</p>
        <div id="questions-container-dynamic">
            ${(questions || []).map((q, index) => `
                <div class="question-card">
                    <label for="answer-${index}">질문 ${index + 1}: ${q}</label>
                    <textarea id="answer-${index}" placeholder="답변을 입력하세요..."></textarea>
                </div>
            `).join('')}
        </div>
        <button id="btn-submit-answers-dynamic">답변 제출 및 최종 제안 생성</button>`;
    questionsStage.innerHTML = questionsHTML;
    document.getElementById('btn-submit-answers-dynamic').addEventListener('click', handleFusionRequest);
}

function renderFusionReport(data) {
    const { fusionTitle, analysis, suggestedEdits } = data;
    const fusionStage = stages.fusion;

    let diffHTML = (suggestedEdits && suggestedEdits.length > 0) 
        ? suggestedEdits.map((edit, index) => `...`).join('') // Shortened for brevity
        : '<p>구체적인 수정 제안이 없습니다.</p>';

    let fusionHTML = `
        <h2>3. 최종 제안: ${fusionTitle}</h2>
        <div class="analysis-section">
            <h3>핵심 분석 요약</h3>
            <div class="fusion-analysis-grid">
                <div class="analysis-item original"><h4>기존 내용</h4><p>${analysis.originalSummary}</p></div>
                <div class="analysis-item change"><h4>핵심 변경점</h4><p>${analysis.keyChange}</p></div>
                <div class="analysis-item conclusion"><h4>결론</h4><p>${analysis.conclusion}</p></div>
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

    let editsForCopy = (suggestedEdits && suggestedEdits.length > 0)
        ? suggestedEdits.map((edit, i) => `\n[수정 제안 #${i+1}]\n- 원본: ${edit.originalText}\n- 제안: ${edit.suggestedRevision}`).join('\n')
        : '';
    fusionResultForCopy = `## 최종 제안: ${fusionTitle}\n\n**핵심 분석**\n- 기존 내용: ${analysis.originalSummary}\n- 변경점: ${analysis.keyChange}\n- 결론: ${analysis.conclusion}\n${editsForCopy}`;
}

function handleCopyResult() {
    navigator.clipboard.writeText(fusionResultForCopy).then(() => {
        const btn = document.getElementById('btn-copy-result-dynamic');
        btn.textContent = '복사 완료!';
        setTimeout(() => { btn.textContent = '결과 텍스트로 복사'; }, 2000);
    });
}

function handleFeedback(isHelpful) {
    document.getElementById('feedback-message').textContent = '피드백을 주셔서 감사합니다!';
    document.getElementById('btn-feedback-yes-dynamic').disabled = true;
    document.getElementById('btn-feedback-no-dynamic').disabled = true;
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

