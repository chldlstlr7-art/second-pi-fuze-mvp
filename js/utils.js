/**
 * XSS 방지를 위한 간단한 HTML 이스케이프 함수
 */
function escapeHTML(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/[&<>"']/g, function(match) {
        return {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[match];
    });
}
