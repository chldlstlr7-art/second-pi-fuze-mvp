// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY' 가져오기 (단일 키 방식)
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("GEMINI_API_KEY 환경 변수가 설정되어야 합니다.");
}
const genAI = new GoogleGenerativeAI(apiKey);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});


// --- 프롬프트 엔지니어링 (속도 최적화: 실시간 검색 제거) ---

// [1단계] 자동 분류 및 통합 분석용 프롬프트
const promptForStep1 = `
You are an expert AI consultant. Your first task is to automatically classify the user's text into 'idea', 'essay', or 'reflection'.
Then, based on that classification, immediately perform a detailed analysis using the corresponding criteria.
Provide a single, consolidated report in JSON format, in Korean. Be extremely fast and concise.

**Plagiarism Analysis Rules:**
1.  **Context is Key:** Differentiate 'plagiarismSuspicion' (no attribution) from 'properCitation' (has quotes/source).
2.  **Ignore Generic Formats:** Do NOT flag general writing structures as structural plagiarism. Focus on unique logical flows from specific, known concepts or works from your internal knowledge.
3.  **Use Internal Knowledge:** For structural plagiarism, provide a well-known real-world example (e.g., 'Airbnb', 'Netflix's recommendation algorithm') INSTEAD of searching for a live URL.

**JSON OUTPUT RULES:**
- Respond with a VALID JSON object. Do not include markdown \`\`\`json.

**JSON STRUCTURE:**
{
  "documentType": "<The category you identified: '아이디어/기획안', '논설문/에세이', or '소감문/리뷰'>",
  "originalityScore": <Number 0-100 for originality>,
  "overallAssessment": "<One-paragraph assessment based on the identified document type.>",
  "judgmentCriteria": [
    "<Criterion 1 relevant to the doc type>",
    "<Criterion 2 relevant to the doc type>",
    "<Criterion 3 relevant to the doc type>"
  ],
  "plagiarismReport": {
    "plagiarismSuspicion": [{ "similarSentence": "<...>", "source": "<...>", "similarityScore": <...> }],
    "properCitation": [{ "citedSentence": "<...>", "source": "<...>" }],
    "commonKnowledge": ["<list of common knowledge phrases found>"],
    "structuralPlagiarism": [{ 
      "sourceLogic": "<name of similar logic/model from your knowledge>", 
      "pointOfSimilarity": "<explanation>",
      "similarityLevel": "<One of: '매우 낮음', '낮음', '보통', '주의', '높음', '매우 높음'>"
    }]
  },
  "questions": ["<...>", "<...>", "<...>"]
}
`;

// [2단계] 최종 융합 아이디어 생성용 프롬프트
const promptForStep2 = `
You are a creative strategist. Synthesize the [Original Idea] and [User's Answers] into a 'Fused Idea'.
Your goal is to provide a concise analysis and concrete, actionable edit suggestions.
Be extremely concise and fast, in Korean.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT. Do not include markdown \`\`\`json.

**JSON STRUCTURE:**
{
  "fusionTitle": "<A new, compelling name for the fused idea.>",
  "analysis": {
    "originalSummary": "<Summarize the core of the original idea in one or two sentences.>",
    "keyChange": "<Explain the most critical change based on the user's answers in one or two sentences.>",
    "conclusion": "<Describe the final fused idea's new value proposition in one or two sentences.>"
  },
  "suggestedEdits": [
    {
      "originalText": "<Select a specific, important paragraph from the user's [Original Idea] that needs improvement.>",
      "suggestedRevision": "<Provide a rewritten, improved version of that paragraph/section, reflecting the fusion.>"
    }
  ]
}
`;

// 4. Vercel 서버리스 함수 (단일 API 호출)
module.exports = async (req, res) => {
    console.time("Total Request Time"); 

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
        
        console.time("Single API Call");
        const result = await model.generateContent(fullPrompt);
        console.timeEnd("Single API Call");
        
        const response = await result.response;
        let analysisResultText = response.text();
        
        console.time("JSON Parsing");
        let jsonTextToParse = analysisResultText;
        const jsonMatch = jsonTextToParse.match(/```json\s*([\sS]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            jsonTextToParse = jsonMatch[1];
        } else {
             const firstBrace = jsonTextToParse.indexOf('{');
             const lastBrace = jsonTextToParse.lastIndexOf('}');
             if (firstBrace !== -1 && lastBrace > firstBrace) {
                  jsonTextToParse = jsonTextToParse.substring(firstBrace, lastBrace + 1);
             }
        }
        
        try {
            const resultJson = JSON.parse(jsonTextToParse);
            console.timeEnd("JSON Parsing");
            console.timeEnd("Total Request Time");
            res.status(200).json(resultJson);
        } catch (e) {
            console.error("JSON Parsing Error:", e.message);
            console.error("Original AI Response:", jsonTextToParse); 
            throw new Error(`AI가 유효하지 않은 JSON 형식으로 응답했습니다.`);
        }

    } catch (error) {
        console.error('AI 분석 중 오류:', error);
        console.timeEnd("Total Request Time");
        res.status(500).json({ error: error.message || 'AI 모델을 호출하는 데 실패했습니다.' });
    }
};

