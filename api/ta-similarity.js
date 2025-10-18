// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY3' 가져오기 (유사성 검사용)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY3);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});

// --- 프롬프트 엔지니어링 (유사성 검사 - 느슨한 기준) ---
const promptForSimilarity = `
You are an expert academic Teaching Assistant (TA).
Your task is *only* to perform a similarity check on the following student report.

**Similarity Analysis Rules (Important - Be 'Broader/Generous'):**
For the 'similarPhrases' section, adopt a *broader (느슨한)* standard. 
This includes not just direct overlaps, but also:
1.  Closely paraphrased sentences that follow the original source's structure.
2.  Standard definitions or common knowledge presented as if it were the user's own insight (lack of citation).
The goal is to flag areas for *review*, not just confirm plagiarism.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT.
- Do not include markdown \`\`\`json or any text outside the JSON structure.

**JSON STRUCTURE:**
{
  "similarPhrases": [
    {
      "phrase": "<The specific phrase from the student's report that meets the 'Broader' criteria.>",
      "likelySource": "<Name of the specific source (e.g., '위키피디아 [토픽] 항목', '특정 논문 제목').>",
      "sourceURL": "<CRITICAL: *You must attempt to provide a direct URL* to the 'likelySource'. If you identified a specific public source, provide its full URL. If a specific URL cannot be recalled, state 'N/A'.>",
      "similarityType": "<Explain *how* it's similar based on the 'Broader' rules (e.g., '표준 정의를 출처 표기 없이 그대로 인용함', '특정 자료의 문장 구조와 매우 흡사하게 의역됨').>"
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
