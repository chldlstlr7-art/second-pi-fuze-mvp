// PDF.js worker 설정
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
}

// 다중 파일 처리 함수
async function handleFileSelect(fileInput, fileListElement, globalFilesArray) {
    const files = fileInput.files;
    if (!files || files.length === 0) return []; // 처리된 파일 배열 반환

    globalFilesArray.length = 0; // 글로벌 목록 초기화
    fileListElement.innerHTML = `<li><span class="status-text">${files.length}개 파일 읽는 중...</span></li>`;

    const extractionPromises = Array.from(files).map(processFile);
    const results = await Promise.all(extractionPromises);

    // 파일 목록 UI 업데이트
    fileListElement.innerHTML = ''; // 목록 비우기
    results.forEach(file => {
        const li = document.createElement('li');
        let statusHtml = '';
        if (file.error) {
            statusHtml = `<span class="status-error">${file.error}</span>`;
        } else {
            statusHtml = `<span class="status-text" style="color: var(--primary-color);">준비 완료</span>`;
        }
        li.innerHTML = `${escapeHTML(file.name)} ${statusHtml}`;
        fileListElement.appendChild(li);
    });

    return results; // 처리된 파일 배열 반환
}

// 단일 파일 처리 헬퍼 함수
async function processFile(file) {
    try {
        let text = '';
        if (file.type === 'application/pdf') {
            text = await extractPdfText(file);
        } else if (file.name.endsWith('.docx')) {
            text = await extractDocxText(file);
        } else {
            throw new Error('지원하지 않는 파일 형식 (.pdf / .docx)');
        }
        return { name: file.name, text: text };
    } catch (error) {
        console.error('File parsing error:', error);
        return { name: file.name, text: null, error: error.message };
    }
}

// .docx 텍스트 추출
function extractDocxText(file) {
     // ... (기존 extractDocxText 코드) ...
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                .then(result => resolve(result.value))
                .catch(reject);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// .pdf 텍스트 추출
async function extractPdfText(file) {
    // ... (기존 extractPdfText 코드) ...
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = async (e) => {
            const arrayBuffer = e.target.result;
            try {
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n\n';
                }
                resolve(fullText);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}
