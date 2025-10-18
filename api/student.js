// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY' 가져오기
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});

// --- 프롬프트 엔지니어링 ---

// [1단계] 자동 분류 및 분석용 프롬프트 (고도화 버전)
const promptForStep1 = `
You are an expert AI consultant with web search capabilities. Your first task is to automatically classify the user's text.
After classifying, you must perform a detailed plagiarism and originality analysis.
Provide a balanced report in JSON format, in Korean. Be extremely fast and concise.

**Plagiarism Analysis Rules (Crucial):**
1.  **Differentiate Plagiarism vs. Citation:** Analyze the context. If a similar sentence is enclosed in quotes ("...") or has a clear source attribution like (Author, Year), classify it as 'properCitation'. If it's presented as the user's own thought without attribution, classify it as 'plagiarismSuspicion'.
2.  **Handle Common Knowledge:** If a sentence is a widely known definition or a common phrase (e.g., "AI is a branch of computer science..."), classify it as 'commonKnowledge'. Do not flag it as plagiarism.
3.  **Verify URLs:** When providing a 'sourceLink' for structural plagiarism, you MUST use your search tool to find a valid, working URL. Separate any descriptive text from the URL itself to prevent broken links.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT.
- Do not include markdown \`\`\`json or any text outside the JSON structure.

**JSON STRUCTURE:**
{
  "documentType": "<'아이디어/기획안', '논설문/에세이', or '소감문/리뷰'>",
  "originalityScore": <Number 0-100>,
  "overallAssessment": "<One-paragraph assessment>",
  "judgmentCriteria": ["<Criterion 1>", "<Criterion 2>", "<Criterion 3>"],
  "plagiarismReport": {
    "plagiarismSuspicion": [{ "similarSentence": "<...>", "source": "<...>", "similarityScore": <...> }],
    "properCitation": [{ "citedSentence": "<...>", "source": "<...>" }],
    "commonKnowledge": ["<list of common knowledge phrases found>"],
    "structuralPlagiarism": [{ "sourceLogic": "<...>", "pointOfSimilarity": "<...>", "similarityLevel": "<...>", "sourceLink": "<VALID URL>" }]
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
- YOU MUST RESPOND WITH A VALID JSON OBJECT.
- Do not include markdown \`\`\`json or any text outside the JSON structure.

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

// 4. Vercel 서버리스 함수
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

        // Robust JSON Parsing
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

