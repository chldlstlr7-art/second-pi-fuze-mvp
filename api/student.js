// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 모든 Gemini API 키 가져오기
const apiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY2,
].filter(key => key);

if (apiKeys.length < 2) {
    // 병렬 처리를 위해 최소 2개의 키가 필요함을 알립니다.
    throw new Error("병렬 처리를 위해 GEMINI_API_KEY와 GEMINI_API_KEY2 환경 변수가 모두 설정되어야 합니다.");
}

// 각 작업에 다른 API 키를 사용
const genAI_1 = new GoogleGenerativeAI(apiKeys[0]);
const genAI_2 = new GoogleGenerativeAI(apiKeys[1]);

// 3. AI 모델 설정
const model_1 = genAI_1.getGenerativeModel({ model: "gemini-2.5-flash" });
const model_2 = genAI_2.getGenerativeModel({ model: "gemini-2.5-flash" });


// --- 프롬프트 엔지니어링 (역할 분리) ---

// [작업 1] 창의성 분석 및 질문 생성용 프롬프트
const promptForAnalysisAndQuestions = `
You are an expert AI consultant. First, classify the user's text into 'idea', 'essay', or 'reflection'.
Then, provide an originality analysis and probing questions based on that type.
Be extremely fast and concise. Output JSON in Korean.

**JSON OUTPUT RULES:**
- Respond with a VALID JSON object without any markdown wrappers.

**JSON STRUCTURE:**
{
  "documentType": "<'아이디어/기획안', '논설문/에세이', or '소감문/리뷰'>",
  "logicalOriginalityScore": <Number 0-100 for structural/logical originality>,
  "coreSummary": ["<1st key logic/sentence>", "<2nd key logic/sentence>", "<3rd key logic/sentence>"],
  "judgmentCriteria": ["<Criterion 1>", "<Criterion 2>", "<Criterion 3>"],
  "questions": ["<...>", "<...>", "<...>"]
}
`;

// [작업 2] 표절 검사 전용 프롬프트
const promptForPlagiarismReport = `
You are a plagiarism detection specialist with web search capabilities.
Analyze the user's text for direct and structural plagiarism.
Be extremely fast and concise. Output JSON in Korean.

**Plagiarism Analysis Rules:**
1.  **Context is Key:** Differentiate 'plagiarismSuspicion' from 'properCitation'.
2.  **Ignore Generic Formats:** Do NOT flag general writing structures as structural plagiarism.
3.  **Verify URLs:** Use your search tool to provide valid, working URLs.
4.  **Report High Similarity:** Report all 'plagiarismSuspicion' instances with a similarityScore >= 80%.

**JSON OUTPUT RULES:**
- Respond with a VALID JSON object without any markdown wrappers.

**JSON STRUCTURE:**
{
  "textPlagiarismScore": <Number 0-100 for textual plagiarism risk>,
  "plagiarismReport": {
    "plagiarismSuspicion": [{ "similarSentence": "<...>", "source": "<...>", "similarityScore": <...> }],
    "properCitation": [{ "citedSentence": "<...>", "source": "<...>" }],
    "commonKnowledge": ["<list of common knowledge phrases found>"],
    "structuralPlagiarism": [{ "sourceLogic": "<...>", "pointOfSimilarity": "<...>", "similarityLevel": "<...>", "sourceLink": "<VALID URL>" }]
  }
}
`;

// [작업 3] 최종 융합 아이디어 생성용 프롬프트
const promptForStep2 = `
You are a creative strategist. Synthesize the [Original Idea] and [User's Answers] into a 'Fused Idea'.
Provide a concise analysis and concrete, actionable edit suggestions.
Be extremely fast and concise. Output JSON in Korean.

**JSON OUTPUT RULES:**
- Respond with a VALID JSON object without any markdown wrappers.

**JSON STRUCTURE:**
{
  "fusionTitle": "<...>", "analysis": { "originalSummary": "<...>", "keyChange": "<...>", "conclusion": "<...>" },
  "suggestedEdits": [{ "originalText": "<...>", "suggestedRevision": "<...>" }]
}
`;


// Vercel 서버리스 함수 (병렬 처리 방식)
module.exports = async (req, res) => {
    console.time("Total Request Time"); 

    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { stage, idea, originalIdea, answers } = req.body;

        let finalResultJson;
        
        if (stage === 'analyze') {
            if (!idea) return res.status(400).json({ error: 'Missing idea.' });

            console.time("Parallel API Calls");

            // 두 개의 작업을 동시에 시작
            const analysisPromise = model_1.generateContent(`${promptForAnalysisAndQuestions}\n\n[User's Text]:\n${idea}`);
            const plagiarismPromise = model_2.generateContent(`${promptForPlagiarismReport}\n\n[User's Text]:\n${idea}`);

            // 두 작업이 모두 끝날 때까지 기다림
            const [analysisResult, plagiarismResult] = await Promise.all([
                analysisPromise,
                plagiarismPromise
            ]);

            console.timeEnd("Parallel API Calls");

            const analysisResponse = await analysisResult.response;
            const plagiarismResponse = await plagiarismResult.response;

            // 각 결과를 파싱
            const analysisJson = JSON.parse(analysisResponse.text().replace(/```json|```/g, ''));
            const plagiarismJson = JSON.parse(plagiarismResponse.text().replace(/```json|```/g, ''));
            
            // 두 결과를 하나의 객체로 병합
            finalResultJson = {
                ...analysisJson,
                ...plagiarismJson
            };
            
        } else if (stage === 'fuse') {
            if (!originalIdea || !answers) return res.status(400).json({ error: 'Missing originalIdea or answers.' });
            
            console.time("API Call: Fusion");
            const fuseResult = await model_1.generateContent(`${promptForStep2}\n\n[Original Idea]:\n${originalIdea}\n\n[User's Answers]:\n${answers.join('\n')}`);
            const fuseResponse = await fuseResult.response;
            const fuseJsonText = fuseResponse.text().replace(/```json|```/g, '');
            finalResultJson = JSON.parse(fuseJsonText);
            console.timeEnd("API Call: Fusion");
        
        } else {
            return res.status(400).json({ error: 'Invalid stage provided.' });
        }
        
        console.timeEnd("Total Request Time");
        res.status(200).json(finalResultJson);

    } catch (error) {
        console.error('AI 분석 중 오류:', error);
        console.timeEnd("Total Request Time");
        res.status(500).json({ error: error.message || 'AI 모델을 호출하는 데 실패했습니다.' });
    }
};

