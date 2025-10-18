// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY' 가져오기
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});


// --- 프롬프트 엔지니어링 (조교/교수용) ---

// [3단계] 조교/교수용: 리포트 평가 프롬프트
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


// 4. Vercel 서버리스 함수 (조교/교수용 로직)
module.exports = async (req, res) => {
    // 4.1. POST 메소드만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        // 4.2. 요청 바디에서 조교/교수 데이터 파싱
        const { stage, reportText } = req.body;

        let prompt = "";
        let userInput = "";
        
        // 4.3. 'stage'가 'assess_report'인지 확인
        if (stage === 'assess_report') {
            // 조교용 3단계: 리포트 평가
            if (!reportText) return res.status(400).json({ error: 'Missing reportText.' });
            prompt = promptForStep3_TA;
            userInput = `Here is the student's report:\n${reportText}`;

        } else {
            // 정의되지 않은 stage
            return res.status(400).json({ error: 'Invalid stage provided (must be assess_report).' });
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
