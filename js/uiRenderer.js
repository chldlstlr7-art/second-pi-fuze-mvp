// js/uiRenderer.js

// 요약 섹션 HTML 생성 (h3 제거)
function renderSummaryHtml(data) {
    // .report-output 제거하고 내용만 반환
    return `<p>${escapeHTML(data.summary)}</p>`;
}

// 점수/평가 섹션 HTML 생성 (h3 제거)
function renderEvaluationHtml(data) {
    const { overallScore, originalityDraft } = data;
    let scoreColor = 'var(--primary-color)';
    if (overallScore < 70) scoreColor = '#F59E0B';
    if (overallScore < 50) scoreColor = '#EF4444';

    // .report-output 제거하고 내용만 반환
    return `
        <div class="eval-container">
            <div class="score-circle" style="background-color: ${scoreColor};">
                <span>${overallScore}</span><small>점</small>
            </div>
            <div class="eval-draft"><p>${escapeHTML(originalityDraft)}</p></div>
        </div>
    `;
}

// 유사성 렌더링 함수 (h3 제거, 서브타이틀 h4 유지)
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

    // 최종 HTML 반환 (h3 제거, report-output 제거)
    return `
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
    `;
}

// 에러 섹션 HTML 생성 (h3 추가 - 오류는 섹션 자체를 대체하므로 제목 필요)
function renderErrorHtml(sectionTitle, errorMessage) {
    let icon = '❓';
    if (sectionTitle.includes("요약")) icon = '📝';
    if (sectionTitle.includes("평가")) icon = '📊';
    if (sectionTitle.includes("유사성")) icon = '⚠️';

    // .report-output을 유지하고 내부 내용만 생성
    return `
        <div class="report-output error-output">
             <h3 style="color: var(--danger-dark); border: none; padding: 0; margin-bottom: 10px;"><span class="section-icon">${icon}</span>${escapeHTML(sectionTitle)} (오류)</h3>
             <p style="color: var(--danger-dark); font-weight: bold; margin: 0;">
                 ${escapeHTML(errorMessage)}
             </p>
         </div>
     `;
}
