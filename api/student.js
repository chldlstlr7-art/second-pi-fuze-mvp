// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY' 가져오기
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});


// --- 프롬프트 엔지니어링 (역할 분리) ---

// [0단계] 문서 유형을 빠르게 분류하기 위한 전용 프롬프트
const promptForClassification = `
Analyze the user's text and classify it into ONE of the following three categories: 'idea', 'essay', or 'reflection'.
Respond with ONLY the category name in English and nothing else.
`;

// [1단계-A] 아이디어/기획안 분석용 프롬프트
const promptForIdea = `
You are an expert AI consultant with web search capabilities. You must analyze the user's idea based on innovation criteria.
Provide a balanced report in JSON format, in Korean. Be extremely fast and concise.

**Plagiarism Analysis Rules (Crucial):**
1.  **Differentiate Plagiarism vs. Citation:** If a similar sentence has clear source attribution like (Author, Year) or is in quotes, classify it as 'properCitation'. Otherwise, classify it as 'plagiarismSuspicion'.
2.  **Handle Common Knowledge:** If a sentence is a common definition, classify it as 'commonKnowledge'.
3.  **Verify URLs:** When providing a 'sourceLink' for structural plagiarism, you MUST use your search tool to find a valid, working URL.

**JSON OUTPUT RULES:**
- Respond with a VALID JSON object. Do not include markdown \`\`\`json.

**JSON STRUCTURE:**
{
  "documentType": "아이디어/기획안",
  "originalityScore": <Number 0-100 for structural originality>,
  "overallAssessment": "<One-paragraph assessment of the idea's originality and potential.>",
  "judgmentCriteria": ["문제 정의의 독창성", "해결 방식의 참신성", "가치 제안의 차별성"],
  "plagiarismReport": {
    "plagiarismSuspicion": [{ "similarSentence": "<found sentence>", "source": "<estimated source>", "similarityScore": <number> }],
    "properCitation": [{ "citedSentence": "<found sentence>", "source": "<user's citation>" }],
    "commonKnowledge": ["<list of common knowledge phrases found>"],
    "structuralPlagiarism": [{ "sourceLogic": "<name of similar logic/model>", "pointOfSimilarity": "<explanation>", "similarityLevel": "<One of: '매우 낮음', '낮음', '보통', '주의', '높음', '매우 높음'>", "sourceLink": "<VALID URL>" }]
  },
  "questions": ["<Question about problem definition>", "<Question about solution approach>", "<Question about value proposition>"]
}
`;

// [1단계-B] 논설문/에세이 분석용 프롬프트
const promptForEssay = `
You are an expert AI writing tutor with web search capabilities. You must analyze the user's essay based on argumentative criteria.
Provide a balanced report in JSON format, in Korean. Be extremely fast and concise.

**Plagiarism Analysis Rules (Crucial):**
1.  **Differentiate Plagiarism vs. Citation:** If a similar sentence has clear source attribution like (Author, Year) or is in quotes, classify it as 'properCitation'. Otherwise, classify it as 'plagiarismSuspicion'.
2.  **Handle Common Knowledge:** If a sentence is a common definition, classify it as 'commonKnowledge'.
3.  **Verify URLs:** When providing a 'sourceLink' for structural plagiarism, you MUST use your search tool to find a valid, working URL.

**JSON OUTPUT RULES:**
- Respond with a VALID JSON object. Do not include markdown \`\`\`json.

**JSON STRUCTURE:**
{
  "documentType": "논설문/에세이",
  "originalityScore": <Number 0-100 for argumentative originality>,
  "overallAssessment": "<One-paragraph assessment of the essay's logical strength and originality.>",
  "judgmentCriteria": ["주장의 명료성", "논리 구조의 독창성", "근거의 참신성"],
  "plagiarismReport": {
    "plagiarismSuspicion": [{ "similarSentence": "<found sentence>", "source": "<estimated source>", "similarityScore": <number> }],
    "properCitation": [{ "citedSentence": "<found sentence>", "source": "<user's citation>" }],
    "commonKnowledge": ["<list of common knowledge phrases found>"],
    "structuralPlagiarism": [{ "sourceLogic": "<name of similar argumentative structure>", "pointOfSimilarity": "<explanation of similar logical flow>", "similarityLevel": "<One of: '매우 낮음', '낮음', '보통', '주의', '높음', '매우 높음'>", "sourceLink": "<VALID URL>" }]
  },
  "questions": ["<Question about the main thesis>", "<Question about the evidence used>", "<Question about potential counterarguments>"]
}
`;

// [1단계-C] 소감문/리뷰 분석용 프롬프트
const promptForReflection = `
You are an AI writing coach. You must analyze the user's reflection/review based on authenticity and expression.
Provide a balanced report in JSON format, in Korean. Be extremely fast and concise.

**Plagiarism Analysis Rules (Crucial):**
1.  **Differentiate Plagiarism vs. Citation:** Focus on direct text similarity. If a sentence seems overly generic or copied, flag it as 'plagiarismSuspicion'.
2.  **Handle Common Knowledge:** Identify and list common phrases under 'commonKnowledge'.

**JSON OUTPUT RULES:**
- Respond with a VALID JSON object. Do not include markdown \`\`\`json.

**JSON STRUCTURE:**
{
  "documentType": "소감문/리뷰",
  "originalityScore": <Number 0-100 for expressive originality (High score = less generic)>,
  "overallAssessment": "<One-paragraph assessment of the reflection's authenticity and expressive quality.>",
  "judgmentCriteria": ["표현의 진정성", "경험의 구체성", "텍스트 유사도"],
  "plagiarismReport": {
    "plagiarismSuspicion": [{ "similarSentence": "<found sentence>", "source": "<estimated source>", "similarityScore": <number> }],
    "properCitation": [],
    "commonKnowledge": ["<list of common knowledge phrases found>"],
    "structuralPlagiarism": []
  },
  "questions": ["<Question to elicit deeper personal insight>", "<Question about a specific expression used>", "<Question about connecting the experience to a broader context>"]
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
      "originalText": "<Select a specific, important paragraph or section from the user's [Original Idea] that needs improvement.>",
      "suggestedRevision": "<Provide a rewritten, improved version of that paragraph/section, reflecting the fusion.>"
    }
  ]
}
`;

// 4. Vercel 서버리스 함수 (핵심 로직: 연쇄 호출 방식으로 변경)
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { stage, idea, originalIdea, answers } = req.body;

        let finalJsonText;
        
        if (stage === 'analyze') {
            if (!idea) return res.status(400).json({ error: 'Missing idea.' });

            // --- API 호출 1: 문서 유형 분류 ---
            const classificationResult = await model.generateContent(`${promptForClassification}\n\n[User's Text]:\n${idea}`);
            const classificationResponse = await classificationResult.response;
            const docType = classificationResponse.text().trim();

            // --- API 호출 2: 분류된 유형에 맞춰 상세 분석 ---
            let analysisPrompt = "";
            switch(docType) {
                case 'idea': analysisPrompt = promptForIdea; break;
                case 'essay': analysisPrompt = promptForEssay; break;
                case 'reflection': analysisPrompt = promptForReflection; break;
                default: throw new Error("AI가 문서 유형을 분류하는 데 실패했습니다.");
            }
            
            const analysisResult = await model.generateContent(`${analysisPrompt}\n\n[User's Text]:\n${idea}`);
            const analysisResponse = await analysisResult.response;
            finalJsonText = analysisResponse.text();

        } else if (stage === 'fuse') {
            if (!originalIdea || !answers) return res.status(400).json({ error: 'Missing originalIdea or answers.' });
            
            const fuseResult = await model.generateContent(`${promptForStep2}\n\n[Original Idea]:\n${originalIdea}\n\n[User's Answers]:\n${answers.join('\n')}`);
            const fuseResponse = await fuseResult.response;
            finalJsonText = fuseResponse.text();
        
        } else {
            return res.status(400).json({ error: 'Invalid stage provided.' });
        }
        
        // --- 최종 JSON 파싱 및 응답 (공통 로직) ---
        let jsonTextToParse = finalJsonText;
        const jsonMatch = jsonTextToParse.match(/```json\s*([\s\S]*?)\s*```/);
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
            res.status(200).json(resultJson);
        } catch (e) {
            console.error("JSON Parsing Error:", e.message);
            console.error("Original AI Response:", jsonTextToParse); 
            throw new Error(`AI가 유효하지 않은 JSON 형식으로 응답했습니다.`);
        }

    } catch (error) {
        console.error('AI 분석 중 오류:', error);
        res.status(500).json({ error: error.message || 'AI 모델을 호출하는 데 실패했습니다.' });
    }
};

