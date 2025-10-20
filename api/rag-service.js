// 1. 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pinecone } = require("@pinecone-database/pinecone");

// 2. 환경 변수 및 API 클라이언트 설정
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

// 환경 변수가 하나라도 없으면 RAG 기능을 비활성화하기 위한 체크
const isRagConfigured = GEMINI_API_KEY && PINECONE_API_KEY && PINECONE_ENVIRONMENT && PINECONE_INDEX_NAME;

let pineconeIndex;
let embeddingModel; // 임베딩 모델 인스턴스를 저장할 변수

if (isRagConfigured) {
    try {
        const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
        pineconeIndex = pinecone.index(PINECONE_INDEX_NAME);
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        // --- 수정된 부분: 임베딩 전용 모델 인스턴스 생성 ---
        embeddingModel = genAI.getGenerativeModel({ model: "models/text-embedding-004" });
    } catch (error) {
        console.error("Pinecone 또는 Gemini 초기화 실패:", error);
    }
}

/**
 * RAG(검색 증강 생성)를 위한 관련 문맥을 검색하는 함수
 * @param {string} text - 사용자가 입력한 원본 글
 * @returns {Promise<string>} - 검색된 논문 초록들을 바탕으로 구성된 문맥(context)
 */
async function searchRelevantContext(text) {
    // RAG 설정이 없거나 초기화에 실패했으면 빈 문맥을 반환
    if (!isRagConfigured || !pineconeIndex || !embeddingModel) {
        console.log("RAG 설정이 없거나 초기화에 실패하여 검색을 건너뜁니다.");
        return "";
    }

    try {
        console.time("RAG: Embedding user query");
        // --- 수정된 부분: 올바른 방식으로 embedContent 호출 ---
        const result = await embeddingModel.embedContent(text);
        const userVector = result.embedding.values;
        console.timeEnd("RAG: Embedding user query");

        if (!userVector) {
            throw new Error("사용자 입력 텍스트를 벡터로 변환하는 데 실패했습니다.");
        }

        console.time("RAG: Querying Pinecone");
        const queryResponse = await pineconeIndex.query({
            vector: userVector,
            topK: 3, // 상위 3개의 관련 문서를 가져옴
            includeMetadata: true,
        });
        console.timeEnd("RAG: Querying Pinecone");

        if (!queryResponse || !queryResponse.matches || queryResponse.matches.length === 0) {
            console.log("Pinecone에서 유사한 문서를 찾지 못했습니다.");
            return "";
        }

        // 검색 결과를 하나의 문맥(context) 텍스트로 조합
        const context = queryResponse.matches
            .map(match => `Title: ${match.metadata.title}\nAbstract: ${match.metadata.text}`)
            .join('\n\n---\n\n');
        
        return context;

    } catch (error) {
        console.error("RAG 문맥 검색 중 오류 발생:", error);
        // 오류 발생 시에도 시스템이 멈추지 않도록 빈 문맥을 반환
        return "";
    }
}

// 다른 파일에서 이 함수를 가져다 쓸 수 있도록 export
module.exports = { searchRelevantContext };

