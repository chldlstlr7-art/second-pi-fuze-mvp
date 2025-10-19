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

// --- (수정) 유사성 렌더링 함수 (소제목 복원) ---
function renderSimilarityHtml(data) {
    // AI 응답이 예상과 다를 경우를 대비하여 기본값 설정
    const structuralSimilarities = data.structuralSimilarities || [];
    const textualSimilarities = data.textualSimilarities || [];

    let structuralHtml = '';
    let textualHtml = '';

    // 1. 구조적 유사성 (Amber) 항목 생성
    if (structuralSimilarities.length > 0) {
        structuralHtml = structuralSimilarities.map(item => {
            let urlHTML = '';
            if (item.sourceURL && item.sourceURL.startsWith('http')) {
                urlHTML = `<br><strong>추정 URL:</strong> <a href="${item.sourceURL}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.sourceURL)}</a>`;
            } else if (item.sourceURL && item.sourceURL !== 'N/A') {
                urlHTML = `<br><strong>추정 URL:</strong> ${escapeHTML(item.sourceURL)}`;
            }

            // 학생용 CSS 클래스(.report-item.structural) 사용
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
    } else {
        // (수정) 리스트 아이템 대신 메시지 표시
        structuralHtml = '<p class="no-similarity-found">해당 없음</p>';
    }

    // 2. 텍스트 유사성 (Red) 항목 생성
    if (textualSimilarities.length > 0) {
        textualHtml = textualSimilarities.map(item => {
             let urlHTML = '';
             if (item.sourceURL && item.sourceURL.startsWith('http')) {
                 urlHTML = `<br><strong>추정 URL:</strong> <a href="${item.sourceURL}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.sourceURL)}</a>`;
             } else if (item.sourceURL && item.sourceURL !== 'N/A') {
                 urlHTML = `<br><strong>추정 URL:</strong> ${escapeHTML(item.sourceURL)}`;
             }

             // 학생용 CSS 클래스(.report-item.textual) 사용
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
    } else {
         // (수정) 리스트 아이템 대신 메시지 표시
        textualHtml = '<p class="no-similarity-found">해당 없음</p>';
    }

    // --- 제목과 두 섹션을 조합하여 최종 HTML 반환 ---
    return `
        <h3>표절 검사 상세 리포트</h3>
        <div id="similarity-report-items">
            
            <h4 class="similarity-subtitle" style="color: var(--warning-color);">
                1. 구조적 유사성 (아이디어/논리 구조)
            </h4>
            ${structuralHtml} 

            <h4 class="similarity-subtitle" style="color: var(--danger-color); margin-top: 30px;">
                2. 텍스트 유사성 (문장/구절 복사)
            </h4>
            ${textualHtml}
            
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

/**
 * XSS 방지를 위한 간단한 HTML 이스케이프 함수 (변경 없음)
 */
function escapeHTML(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/[&<>"']/g, function(match) {
        return {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[match];
    });
}
