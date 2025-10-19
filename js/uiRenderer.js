// js/uiRenderer.js

// 요약 섹션 HTML 생성 (변경 없음)
function renderSummaryHtml(data) {
    return `
        <div class="report-output">
            <h3>핵심 요약</h3>
            <p>${escapeHTML(data.summary)}</p>
        </div>
    `;
}

// 점수/평가 섹션 HTML 생성 (변경 없음)
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

// --- (수정) 유사성 렌더링 함수 (학생용 디자인 적용) ---
function renderSimilarityHtml(data) {
    const structuralSimilarities = data.structuralSimilarities || [];
    const textualSimilarities = data.textualSimilarities || [];

    let structuralHtml = '';
    let textualHtml = '';

    // 1. 구조적 유사성 (Amber)
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
                        ${urlHTML}
                        <br><strong>유사성 유형:</strong> ${escapeHTML(item.similarityType)}
                    </div>
                </div>
            `;
        }).join('');
    }

    // 2. 텍스트 유사성 (Red)
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
                        ${urlHTML}
                        <br><strong>유사성 유형:</strong> ${escapeHTML(item.similarityType)}
                    </div>
                </div>
            `;
        }).join('');
    }

    // --- 두 섹션을 조합하여 최종 HTML 반환 ---
    let finalHtml = '';
    if (structuralHtml || textualHtml) { // 둘 중 하나라도 내용이 있으면
         finalHtml = structuralHtml + textualHtml; // 순서대로 합침
    } else {
        // 둘 다 없으면 메시지 표시
        finalHtml = '<p class="no-similarity-found">구조적 또는 텍스트 유사성이 감지되지 않았습니다.</p>';
    }

    return `
        <div class="report-output">
            <h3 style="color: #D97706;">유사성 검토 항목 (참고)</h3>
            <div id="similarity-report-items">
                ${finalHtml}
            </div>
        </div>
    `;
}

// 에러 섹션 HTML 생성 (변경 없음)
function renderErrorHtml(sectionTitle, errorMessage) {
    return `
        <div class="report-output" style="border-color: #FCA5A5; background-color: #FEF2F2;">
            <h3 style="color: #DC2626;">${escapeHTML(sectionTitle)} (오류)</h3>
            <p style="color: #B91C1C; font-weight: bold;">
                ${escapeHTML(errorMessage)}
            </p>
        </div>
    `;
}
