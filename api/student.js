// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY' 가져오기
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});


// --- 프롬프트 엔지니어링 (AI 자동 분류 기능 추가) ---

// [1단계] 자동 분류 및 분석용 프롬프트
const promptForStep1 = `
You are an expert AI consultant with web search capabilities. Your first task is to automatically classify the user's text into one of three categories: 'idea' (for proposals/plans), 'essay' (for arguments/theses), or 'reflection' (for reviews/personal accounts).
After classifying, you must immediately perform a detailed analysis based on that specific category's criteria.
Provide a balanced report in JSON format, in Korean. Be extremely fast and concise.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT.
- Do not include markdown \`\`\`json or any text outside the JSON structure.
- For the 'structuralPlagiarism' part, use your search capabilities to find a real source and provide a valid URL.

**JSON STRUCTURE:**
{
  "documentType": "<The category you identified: '아이디어/기획안', '논설문/에세이', or '소감문/리뷰'>",
  "originalityScore": <Number 0-100 for originality based on the document type's criteria>,
  "overallAssessment": "<One-paragraph assessment based on the document type.>",
  "judgmentCriteria": [
    "<Criterion 1 relevant to the doc type>",
    "<Criterion 2 relevant to the doc type>",
    "<Criterion 3 relevant to the doc type>"
  ],
  "plagiarismReport": {
    "directPlagiarism": [{ "similarSentence": "<found sentence>", "source": "<estimated source>", "similarityScore": <number> }],
    "structuralPlagiarism": [{ 
      "sourceLogic": "<name of similar logic/model>", 
      "pointOfSimilarity": "<explanation>",
      "similarityLevel": "<One of: '매우 낮음', '낮음', '보통', '주의', '높음', '매우 높음'>",
      "sourceLink": "<A valid URL to the source found via search. If none, provide an empty string ''.>"
    }]
  },
  "questions": [
    "<A question relevant to the doc type>",
    "<A second question relevant to the doc type>",
    "<A third question relevant to the doc type>"
  ]
}
`;


// [2단계] 답변을 받아 최종 융합 아이디어 생성용 프롬프트
const promptForStep2 = `
You are a creative strategist. Synthesize the [Original Idea] and [User's Answers] into a 'Fused Idea'.
Incorporate the user's answers to evolve the original concept.
Be extremely concise and fast, in Korean.

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

// 4. Vercel 서버리스 함수 (핵심 로직)
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { stage, idea, originalIdea, answers } = req.body;

        let prompt = "";
        let userInput = "";
        
        if (stage === 'analyze') {
            if (!idea) return res.status(400).json({ error: 'Missing idea.' });
            prompt = promptForStep1;
            userInput = `[User's Text]:\n${idea}`;

        } else if (stage === 'fuse') {
            if (!originalIdea || !answers) return res.status(400).json({ error: 'Missing originalIdea or answers.' });
            prompt = promptForStep2;
            userInput = `[Original Idea]:\n${originalIdea}\n\n[User's Answers]:\n${answers.join('\n')}`;
        
        } else {
            return res.status(400).json({ error: 'Invalid stage provided.' });
        }
        
        const fullPrompt = `${prompt}\n\n${userInput}`;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        let analysisResultText = response.text();

        // --- Robust JSON Parsing ---
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
            console.error("JSON Parsing Error:", e.message);
            console.error("Original AI Response:", analysisResultText); 
            throw new Error(`AI가 유효하지 않은 JSON 형식으로 응답했습니다.`);
        }

    } catch (error) {
        console.error('AI 분석 중 오류:', error);
        res.status(500).json({ error: error.message || 'AI 모델을 호출하는 데 실패했습니다.' });
    }
};

