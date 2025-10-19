// 요약 섹션 HTML 생성
function renderSummaryHtml(data) {
    return `
        <div class="report-output">
            <h3>핵심 요약</h3>
            <p>${escapeHTML(data.summary)}</p>
        </div>
    `;
}

// 점수/평가 섹션 HTML 생성
function renderEvaluationHtml(data) {
    const { overallScore, originalityDraft } = data;
    let scoreColor = 'var(--primary-color)';
    if (overallScore < 70) scoreColor = '#F59E0B';
    if (overallScore < 50) scoreColor = '#EF4444';

    return `
        <div class="report-output">
            <h3>종합 점수 및 평가</h3>
            <div class="eval-container">
                <div class="score-circle" style="background-color: ${scoreColor};">
                    <span>${overallScore}</span><small>점</small>
                </div>
                <div class="eval-draft"><p>${escapeHTML(originalityDraft)}</p></div>
            </div>
        </div>
    `;
}

// 유사성 섹션 HTML 생성
function renderSimilarityHtml(data) {
    const structuralSimilarities = data.structuralSimilarities || [];
    const textualSimilarities = data.textualSimilarities || [];
    let structuralHtml = '';
    let textualHtml = '';

    // 구조적 유사성 (Amber)
    if (structuralSimilarities.length > 0) {
        structuralHtml = structuralSimilarities.map(item => {
            let urlHTML = '';
            if (item.sourceURL && item.sourceURL.startsWith('http')) {
                urlHTML = `<br><strong>추정 URL:</strong> <a href="${item.sourceURL}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.sourceURL)}</a>`;
            } else if (item.sourceURL && item.sourceURL !== 'N/A') {
                urlHTML = `<br><strong>추정 URL:</strong> ${escapeHTML(item.sourceURL)}`;
            }
            return `
                <li class="similarity-card type-structural">
                    <p class="similarity-description">"${escapeHTML(item.area)}"</p>
                    <div class="suspicious-details">
                        <strong>유사 출처 (추정):</strong> ${escapeHTML(item.likelySource)}
                        ${urlHTML}<br><strong>유사성 유형:</strong> ${escapeHTML(item.similarityType)}
                    </div>
                </li>`;
        }).join('');
    } else { structuralHtml = '<li class="no-result">해당 없음</li>'; }

    // 텍스트 유사성 (Red)
    if (textualSimilarities.length > 0) {
        textualHtml = textualSimilarities.map(item => {
             let urlHTML = '';
             if (item.sourceURL && item.sourceURL.startsWith('http')) {
                 urlHTML = `<br><strong>추정 URL:</strong> <a href="${item.sourceURL}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.sourceURL)}</a>`;
             } else if (item.sourceURL && item.sourceURL !== 'N/A') {
                 urlHTML = `<br><strong>추정 URL:</strong> ${escapeHTML(item.sourceURL)}`;
             }
             return `
                <li class="similarity-card type-textual">
                    <p class="suspicious-phrase">"${escapeHTML(item.phrase)}"</p>
                    <div class="suspicious-details">
                        <strong>유사 출처 (추정):</strong> ${escapeHTML(item.likelySource)}
                        ${urlHTML}<br><strong>유사성 유형:</strong> ${escapeHTML(item.similarityType)}
                    </div>
                </li>`;
        }).join('');
    } else { textualHtml = '<li class="no-result">해당 없음</li>'; }

    return `
        <div class="report-output" style="background-color: #F9FAFB;">
            <h3 style="color: #D97706;">유사성 검토 항목 (참고)</h3>
            <h4 class="similarity-subtitle" style="color: var(--warning-color);">1. 구조적 유사성 (아이디어/논리 구조)</h4>
            <ul class="similarity-list">${structuralHtml}</ul>
            <h4 class="similarity-subtitle" style="color: var(--danger-color); margin-top: 30px;">2. 텍스트 유사성 (문장/구절 복사)</h4>
            <ul class="similarity-list">${textualHtml}</ul>
        </div>`;
}

// 에러 섹션 HTML 생성
function renderErrorHtml(sectionTitle, errorMessage) {
    return `
        <div class="report-output" style="border-color: #FCA5A5; background-color: #FEF2F2;">
            <h3 style="color: #DC2626;">${escapeHTML(sectionTitle)} (오류)</h3>
            <p style="color: #B91C1C; font-weight: bold;">${escapeHTML(errorMessage)}</p>
        </div>`;
}
