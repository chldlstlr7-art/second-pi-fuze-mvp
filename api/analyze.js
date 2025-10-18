// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY' 가져오기
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});


// --- 프롬프트 엔지니어링 ---

// [1단계] 학생용: 최초 아이디어 분석 및 질문 생성용 프롬프트
const promptForStep1 = `
Analyze the user's idea. Provide a balanced report in JSON format.
Find a real-world parallel and highlight similarities and differences.
Also, conduct a 'text similarity check'. Find key phrases or sentences in the user's idea that are overly similar to common knowledge or existing products.
Be concise, in korean.

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

// [3단계] 조교/교수용: 리포트 평가 프롬프트 (신규 추가)
const promptForStep3_TA = `
You are an expert academic Teaching Assistant (TA). Your goal is to analyze a student's report and provide a draft assessment for the professor.
Be objective, constructive, and concise. Respond in Korean.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT.
- Do not include markdown \`\`\`json or any text outside the JSON structure.

**JSON STRUCTURE:**
{
  "summary": "<A concise one-paragraph summary of the report's main argument and conclusion.>",
  "originalityDraft": "<A one-paragraph preliminary assessment of the report's originality, suitable for a TA's feedback report.>",
  "keyStrengths": [
    "<A key strength of the report (e.g., '논리 전개가 명확함')>",
    "<Another key strength (e.g., '독창적인 데이터 해석 시도')>"
  ],
  "areasForImprovement": [
    "<A key weakness or area for improvement (e.g., '핵심 주장에 대한 근거 부족')>",
    "<Another area for improvement (e.g., '기존 연구와의 차별성 부각 필요')>"
  ],
  "similarPhrases": [
    "<List any specific sentences or phrases that seem overly common or potentially plagiarized from known sources. If none, return an empty array [].>"
  ]
}
`;


// 4. Vercel 서버리스 함수 (핵심 로직)
module.exports = async (req, res) => {
    // 4.1. POST 메소드만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        // 4.2. 요청 바디에서 stage 및 관련 데이터 파싱
        const { stage, idea, originalIdea, answers, reportText } = req.body;

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
        
        } else if (stage === 'assess_report') {
            // 조교용 3단계: 리포트 평가
            if (!reportText) return res.status(400).json({ error: 'Missing reportText.' });
            prompt = promptForStep3_TA;
            userInput = `Here is the student's report:\n${reportText}`;

        } else {
            // 정의되지 않은 stage
            return res.status(400).json({ error: 'Invalid stage provided.' });
        }
        
        // 4.4. AI 모델에 보낼 전체 프롬프트 구성
        const fullPrompt = `${prompt}\n\n${userInput}`;
        
        // 4.5. AI 모델 호출
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        let analysisResultText = response.text();

        // 4.6. 견고한 JSON 파싱 (Robust JSON Parsing)
        // AI가 마크다운(```json)을 포함했거나 앞뒤에 불필요한 텍스트를 붙였을 경우 대비
        
        const jsonMatch = analysisResultText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            // 1. 마크다운 블록이 있다면 내부 텍스트만 추출
            analysisResultText = jsonMatch[1];
        } else {
            // 2. 마크다운이 없다면, 첫 '{'와 마지막 '}'를 기준으로 파싱 시도
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
            console.error("Original AI Response:", analysisResultText); // 실패한 텍스트 로그 기록
            throw new Error(`AI가 유효하지 않은 JSON 형식으로 응답했습니다. (파싱 실패)`);
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
