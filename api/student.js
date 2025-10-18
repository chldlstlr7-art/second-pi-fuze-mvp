// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY' 가져오기
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});


// --- 프롬프트 엔지니어링 (학생용) ---

// [1단계] 학생용: 최초 아이디어 분석 및 질문 생성용 프롬프트
const promptForStep1 = `
Analyze the user's idea. Provide a balanced report in JSON format.
Find a real-world parallel and highlight similarities and differences.
Also, conduct a 'text similarity check'. Find key phrases or sentences in the user's idea that are overly similar to common knowledge or existing products.
Be concise and fast(in 10seconds), in korean.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT.
- Do not include markdown \`\`\`json or any text outside the JSON structure.

**JSON STRUCTURE:**
{
  "originalityScore": <Number from 0-100 for structural originality. High score = very original.>,
  "overallAssessment": "<One-paragraph assessment of the idea's originality and potential.>",
  "judgmentCriteria": [
    "문제 정의의 독창성",
    "해결 방식의 참신성",
    "가치 제안의 차별성"
  ],
  "comparisonAnalysis": {
    "existingExampleName": "<Name of a similar real-world service.>",
    "existingExampleDesc": "<One-sentence description of the existing service.>",
    "pointsOfSimilarity": "<Explain structural similarities with the existing service.>",
    "pointsOfDifference": "<Explain creative differences and unique points of the user's idea.>"
  },
  "similarityReport": {
     "highlySimilarPhrases": [
       "<List key phrases or sentences that are highly similar to well-known concepts. If none, return an empty array [].>"
     ],
     "reportSummary": "<A brief one-sentence summary about the textual similarity.>"
  },
  "questions": [
    "<A question challenging the user's core assumptions.>",
    "<A question to expand the idea's scope.>",
    "<A question to consider a more specific niche market.>"
  ]
}
`;


// [2단계] 학생용: 답변을 받아 최종 융합 아이디어 생성용 프롬프트
const promptForStep2 = `
You are a creative strategist. Synthesize the [Original Idea] and [User's Answers] into a 'Fused Idea'.
Incorporate the user's answers to evolve the original concept.
Be concise and fast.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT.
- Do not include markdown \`\`\`json or any text outside the JSON structure.

**JSON STRUCTURE:**
{
  "fusionTitle": "<A new, compelling name for the fused idea.>",
  "fusionSummary": "<A one-paragraph summary of the final fused idea.>",
  "connection": "<Explain how the user's answers transformed the original idea into this new concept.>",
  "keyFeatures": [
    "<First key feature of the fused idea.>",
    "<Second key feature.>",
    "<Third key feature.>"
  ]
}
`;


// 4. Vercel 서버리스 함수 (학생용 로직)
module.exports = async (req, res) => {
    // 4.1. POST 메소드만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        // 4.2. 요청 바디에서 학생 데이터 파싱
        const { stage, idea, originalIdea, answers } = req.body;

        let prompt = "";
        let userInput = "";
        
        // 4.3. 'stage'에 따라 적절한 프롬프트와 입력 데이터 할당
        if (stage === 'analyze') {
            // 학생용 1단계: 아이디어 분석
            if (!idea) return res.status(400).json({ error: 'Missing idea.' });
            prompt = promptForStep1;
            userInput = `Here is the user's idea:\n${idea}`;

        } else if (stage === 'fuse') {
            // 학생용 2단계: 아이디어 융합
            if (!originalIdea || !answers) return res.status(400).json({ error: 'Missing originalIdea or answers.' });
            prompt = promptForStep2;
            userInput = `[Original Idea]:\n${originalIdea}\n\n[User's Answers]:\n${answers.join('\n')}`;
        
        } else {
            // 정의되지 않은 stage
            return res.status(400).json({ error: 'Invalid stage provided (must be analyze or fuse).' });
        }
        
        // 4.4. AI 모델에 보낼 전체 프롬프트 구성
        const fullPrompt = `${prompt}\n\n${userInput}`;
        
        // 4.5. AI 모델 호출
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        let analysisResultText = response.text();

        // 4.6. 견고한 JSON 파싱 (Robust JSON Parsing)
        const jsonMatch = analysisResultText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            analysisResultText = jsonMatch[1];
        } else {
            const firstBrace = analysisResultText.indexOf('{');
            const lastBrace = analysisResultText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                 analysisResultText = analysisResultText.substring(firstBrace, lastBrace + 1);
            }
        }

        try {
            // 4.7. 텍스트를 JSON 객체로 파싱
            const analysisResultJson = JSON.parse(analysisResultText);
            // 4.8. 성공 시 JSON 응답 전송
            res.status(200).json(analysisResultJson);

        } catch (e) {
            // 4.9. JSON 파싱 실패 시 서버 에러 전송
            console.error("JSON Parsing Error:", e.message);
            console.error("Original AI Response:", analysisResultText); 
            throw new Error(`AI가 유효하지 않은 JSON 형식으로 응답했습니다.`);
        }

    } catch (error) {
        // 4.10. API 호출 등 외부 요인으로 인한 에러 처리
        console.error('AI 분석 중 오류:', error);
        let errorMessage = 'AI 모델을 호출하는 데 실패했습니다.';
        if (error.message) {
            errorMessage = error.message;
        }
        res.status(500).json({ error: errorMessage });
    }
};
