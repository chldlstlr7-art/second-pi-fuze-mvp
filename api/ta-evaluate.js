// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY2' 가져오기 (평가용)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY2);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});

// --- 프롬프트 엔지니어링 (평가 전용) ---
const promptForEvaluation = `
You are an expert academic Teaching Assistant (TA).
Your task is *only* to evaluate the following student report for originality, strengths, and weaknesses.
Be objective and constructive. Respond in Korean.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT.
- Do not include markdown \`\`\`json or any text outside the JSON structure.

**JSON STRUCTURE:**
{
  "originalityDraft": "<A one-paragraph preliminary assessment of the report's originality.>",
  "keyStrengths": [
    "<A key strength of the report (e.g., '논리 전개가 명확함')>",
    "<Another key strength>"
  ],
  "areasForImprovement": [
    "<A key weakness or area for improvement (e.g., '핵심 주장에 대한 근거 부족')>",
    "<Another area for improvement>"
  ]
}
`;

// 4. Vercel 서버리스 함수
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { stage, reportText } = req.body;

        // 이 API는 'evaluate' stage만 처리
        if (stage !== 'evaluate' || !reportText) {
            return res.status(400).json({ error: 'Invalid request. Must use stage "evaluate" and provide reportText.' });
        }
        
        const fullPrompt = `${promptForEvaluation}\n\nHere is the student's report:\n${reportText}`;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        let analysisResultText = response.text();

        // 견고한 JSON 파싱
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
            const analysisResultJson = JSON.parse(analysisResultText);
            res.status(200).json(analysisResultJson);
        } catch (e) {
            console.error("JSON Parsing Error (Evaluate):", analysisResultText); 
            throw new Error(`AI가 유효하지 않은 JSON 형식으로 응답했습니다. (평가)`);
        }

    } catch (error) {
        console.error('AI 분석 중 오류 (Evaluate):', error);
        res.status(500).json({ error: error.message || 'AI 모델 호출에 실패했습니다.' });
    }
};
