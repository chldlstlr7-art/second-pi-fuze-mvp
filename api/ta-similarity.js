// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY3' 가져오기 (유사성 검사용)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY3);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
});

// --- 프롬프트 엔지니어링 (유사성 검사 - 구조적/텍스트 분리) ---
const promptForSimilarity = `
You are an expert academic Teaching Assistant (TA).
Your task is *only* to perform a similarity check on the following student report.
You must categorize findings into *two distinct types*: 'structuralSimilarities' and 'textualSimilarities'.

**Analysis Types:**
1.  **Structural Similarities (구조적 유사성):** Analyze the report's overall structure, flow of ideas, argument logic, or unique conceptual framework. Compare it to known existing works, theories, or common patterns. Flag instances where the *structure itself* seems heavily borrowed, even if the words are different. (아이디어 전개 방식, 논리 구조 등이 기존 자료와 유사한 경우). Focus on *how* the argument is built.
2.  **Textual Similarities (텍스트 유사성):** Analyze specific sentences or phrases within the report. Flag instances of direct word-for-word copying or minimal paraphrasing (only a few words changed) from external sources. Focus on *what* specific text overlaps.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT.
- Do not include markdown \`\`\`json or any text outside the JSON structure.
- Populate both arrays. If no instances of a type are found, return an empty array [] for that key.

**JSON STRUCTURE:**
{
  "structuralSimilarities": [
    {
      "area": "<Describe the area of structural similarity (e.g., '보고서의 챕터 구성 방식', '핵심 주장의 논리 전개').>",
      "likelySource": "<Name of the likely source of the structure/idea (e.g., '특정 연구 방법론', '유명 이론의 프레임워크', '일반적인 보고서 형식').>",
      "sourceURL": "<A *possible* URL related to the source structure/idea. State 'N/A' if unknown or not applicable.>",
      "similarityType": "<Explain *how* the structure is similar (e.g., '소스의 단계별 분석 구조를 그대로 따름', '특정 이론의 핵심 개념 순서를 차용함').>"
    }
  ],
  "textualSimilarities": [
    {
      "phrase": "<The specific student's phrase with direct text overlap or minimal changes.>",
      "likelySource": "<Name of the specific source text.>",
      "sourceURL": "<A *possible* URL to the source text. State 'N/A' if unknown.>",
      "similarityType": "<Explain *how* the text is similar (e.g., '출처 표기 없이 원문을 그대로 복사함', '단어 몇 개만 바꾸고 문장 구조는 동일함').>"
    }
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

        // 이 API는 'check_similarity' stage만 처리
        if (stage !== 'check_similarity' || !reportText) {
            return res.status(400).json({ error: 'Invalid request. Must use stage "check_similarity" and provide reportText.' });
        }

        const fullPrompt = `${promptForSimilarity}\n\nHere is the student's report:\n${reportText}`;

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
            // 필수 키 존재 여부 확인 (더욱 견고하게)
            if (!analysisResultJson.structuralSimilarities || !analysisResultJson.textualSimilarities) {
                 throw new Error("AI response missing required keys (structuralSimilarities or textualSimilarities).");
            }
            res.status(200).json(analysisResultJson);
        } catch (e) {
            console.error("JSON Parsing Error or Validation Failed (Similarity):", analysisResultText);
            // JSON 파싱 실패 시 기본 구조라도 반환 (프론트엔드 오류 방지)
            if (!res.headersSent) {
                res.status(500).json({
                    error: `AI 응답 처리 중 오류: ${e.message}`,
                    structuralSimilarities: [],
                    textualSimilarities: []
                });
            }
        }

    } catch (error) {
        console.error('AI 분석 중 오류 (Similarity):', error);
         if (!res.headersSent) {
            res.status(500).json({
                error: error.message || 'AI 모델 호출에 실패했습니다.',
                structuralSimilarities: [],
                textualSimilarities: []
            });
         }
    }
};
