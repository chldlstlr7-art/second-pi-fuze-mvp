// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY3' 가져오기 (유사성 검사용)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY3);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});

// --- 프롬프트 엔지니어링 (유사성 검사 - 2가지 유형 분리) ---
const promptForSimilarity = `
You are an expert academic Teaching Assistant (TA).
Your task is *only* to perform a similarity check on the following student report.
You must categorize findings into *two distinct types*: 'paraphrasingPlagiarism' and 'copyPastePlagiarism'.

**Analysis Types:**
1.  **Paraphrasing Plagiarism (의역 표절):** This is about *conceptual theft*. The student steals the core idea, logical structure, or unique concept from a source, even if they used different words. (단순히 단어를 바꾸는 수준을 넘어 원문의 아이디어와 개념을 도용하는 행위).
2.  **Copy/Paste Plagiarism (단순 복제 표절):** This is about *textual theft*. The student copies text word-for-word (verbatim) or with only minimal changes (e.g., swapping a few words).

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT.
- Do not include markdown \`\`\`json or any text outside the JSON structure.
- Populate both arrays. If no instances of a type are found, return an empty array [] for that key.

**JSON STRUCTURE:**
{
  "paraphrasingPlagiarism": [
    {
      "phrase": "<The student's phrase that conceptually copies an idea.>",
      "likelySource": "<Name of the original source/idea.>",
      "sourceURL": "<A *possible* URL to the source. State 'N/A' if unknown.>",
      "similarityType": "<Explain *how* it's conceptual theft (e.g., '원본의 핵심 논리 구조를 그대로 차용함').>"
    }
  ],
  "copyPastePlagiarism": [
    {
      "phrase": "<The student's phrase that is a direct copy or minimally changed.>",
      "likelySource": "<Name of the specific source.>",
      "sourceURL": "<A *possible* URL to the source. State 'N/A' if unknown.>",
      "similarityType": "<Explain *how* it's textual theft (e.g., '출처 표기 없이 원문을 그대로 복사함').>"
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
        const jsonMatch = analysisResultText.match(/```json\s*([\sS]*?)\s*```/);
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
            console.error("JSON Parsing Error (Similarity):", analysisResultText); 
            throw new Error(`AI가 유효하지 않은 JSON 형식으로 응답했습니다. (유사성)`);
        }

    } catch (error) {
        console.error('AI 분석 중 오류 (Similarity):', error);
        res.status(500).json({ error: error.message || 'AI 모델 호출에 실패했습니다.' });
    }
};
