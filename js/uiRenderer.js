// js/uiRenderer.js

// 요약 섹션 HTML 생성 (아이콘 추가)
function renderSummaryHtml(data) {
    return `
        <div class="report-output">
            <h3><span class="section-icon">📝</span>핵심 요약</h3>
            <p>${escapeHTML(data.summary)}</p>
        </div>
    `;
}

// 점수/평가 섹션 HTML 생성 (아이콘 추가)
function renderEvaluationHtml(data) {
    const { overallScore, originalityDraft } = data;
    let scoreColor = 'var(--primary-color)';
    if (overallScore < 70) scoreColor = '#F59E0B';
    if (overallScore < 50) scoreColor = '#EF4444';

    return `
        <div class="report-output">
            <h3><span class="section-icon">📊</span>종합 점수 및 평가</h3>
            <div class="eval-container">
                <div class="score-circle" style="background-color: ${scoreColor};">
                    <span>${overallScore}</span><small>점</small>
                </div>
                <div class="eval-draft"><p>${escapeHTML(originalityDraft)}</p></div>
            </div>
        </div>
    `;
}

// 유사성 렌더링 함수 (아이콘 추가)
function renderSimilarityHtml(data) {
    const structuralSimilarities = data.structuralSimilarities || [];
    const textualSimilarities = data.textualSimilarities || [];
    let structuralHtml = '';
    let textualHtml = '';

    // 구조적 유사성 항목 생성
    if (structuralSimilarities.length > 0) {
        structuralHtml = structuralSimilarities.map(item => {
            let urlHTML = '';
            if (item.sourceURL && item.sourceURL.startsWith('http')) {
                urlHTML = `<br><strong>추정 URL:</strong> <a href="${item.sourceURL}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.sourceURL)}</a>`;
            } else if (item.sourceURL && item.sourceURL !== 'N/A') {
                urlHTML = `<br><strong>추정 URL:</strong> ${escapeHTML(item.sourceURL)}`;
            }
            return `
                <div class="report-item structural">
                    <h4>${escapeHTML(item.area)}</h4>
                    <div class="suspicious-details">
                        <strong>유사 출처 (추정):</strong> ${escapeHTML(item.likelySource)}
                        ${urlHTML}<br><strong>유사성 유형:</strong> ${escapeHTML(item.similarityType)}
                    </div>
                </div>`;
        }).join('');
    } else { structuralHtml = '<p class="no-similarity-found">해당 없음</p>'; }

    // 텍스트 유사성 항목 생성
    if (textualSimilarities.length > 0) {
        textualHtml = textualSimilarities.map(item => {
             let urlHTML = '';
             if (item.sourceURL && item.sourceURL.startsWith('http')) {
                 urlHTML = `<br><strong>추정 URL:</strong> <a href="${item.sourceURL}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.sourceURL)}</a>`;
             } else if (item.sourceURL && item.sourceURL !== 'N/A') {
                 urlHTML = `<br><strong>추정 URL:</strong> ${escapeHTML(item.sourceURL)}`;
             }
             return `
                <div class="report-item textual">
                    <h4>"${escapeHTML(item.phrase)}"</h4>
                    <div class="suspicious-details">
                        <strong>유사 출처 (추정):</strong> ${escapeHTML(item.likelySource)}
                        ${urlHTML}<br><strong>유사성 유형:</strong> ${escapeHTML(item.similarityType)}
                    </div>
                </div>`;
        }).join('');
    } else { textualHtml = '<p class="no-similarity-found">해당 없음</p>'; }

    // 최종 HTML 반환 (아이콘 추가)
    return `
        <div class="report-output">
            <h3 style="color: #D97706;"><span class="section-icon">⚠️</span>유사성 검토 항목 (참고)</h3>
            <div id="similarity-report-items">
                <h4 class="similarity-subtitle" style="color: var(--warning-color);">
                   <span class="section-icon">🧬</span> 1. 구조적 유사성 (아이디어/논리 구조)
                </h4>
                ${structuralHtml}
                <h4 class="similarity-subtitle" style="color: var(--danger-color); margin-top: 30px;">
                   <span class="section-icon">💬</span> 2. 텍스트 유사성 (문장/구절 복사)
                </h4>
                ${textualHtml}
            </div>
        </div>
    `;
}

// 에러 섹션 HTML 생성 (아이콘 추가)
function renderErrorHtml(sectionTitle, errorMessage) {
    let icon = '❓'; // 기본 아이콘
    if (sectionTitle.includes("요약")) icon = '📝';
    if (sectionTitle.includes("평가")) icon = '📊';
    if (sectionTitle.includes("유사성")) icon = '⚠️';

    return `
        <div class="report-output" style="border-color: #FCA5A5; background-color: #FEF2F2;">
            <h3 style="color: #DC2626;"><span class="section-icon">${icon}</span>${escapeHTML(sectionTitle)} (오류)</h3>
            <p style="color: #B91C1C; font-weight: bold;">
                ${escapeHTML(errorMessage)}
            </p>
        </div>
    `;
}
