// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY' 가져오기
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});


// --- 프롬프트 엔지니어링 (문서 유형별 분리) ---

// [유형 1] 아이디어/기획안 분석용 프롬프트
const promptForIdea = `
Analyze the user's idea/proposal based on innovation criteria. Provide a balanced report in JSON format, in Korean.
Find a real-world parallel, highlighting similarities and creative differences.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT. Do not include markdown or any text outside the JSON.

**JSON STRUCTURE:**
{
  "documentType": "idea",
  "originalityScore": <Number 0-100 for structural originality>,
  "overallAssessment": "<One-paragraph assessment of the idea's originality and potential.>",
  "judgmentCriteria": ["문제 정의의 독창성", "해결 방식의 참신성", "가치 제안의 차별성"],
  "plagiarismReport": {
    "directPlagiarism": [{ "similarSentence": "<found sentence>", "source": "<estimated source>", "similarityScore": <number> }],
    "structuralPlagiarism": [{ "sourceLogic": "<name of similar logic/model>", "pointOfSimilarity": "<explanation>" }]
  },
  "questions": ["<question 1>", "<question 2>", "<question 3>"]
}
`;

// [유형 2] 논설문/에세이 분석용 프롬프트
const promptForEssay = `
Analyze the user's essay based on argumentative criteria. Provide a balanced report in JSON format, in Korean.
Focus on logical flow, argument structure, and originality of claims.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT. Do not include markdown or any text outside the JSON.

**JSON STRUCTURE:**
{
  "documentType": "essay",
  "originalityScore": <Number 0-100 for argumentative originality>,
  "overallAssessment": "<One-paragraph assessment of the essay's logical strength and originality.>",
  "judgmentCriteria": ["주장의 명료성", "논리 구조의 독창성", "근거의 참신성"],
  "plagiarismReport": {
    "directPlagiarism": [{ "similarSentence": "<found sentence>", "source": "<estimated source>", "similarityScore": <number> }],
    "structuralPlagiarism": [{ "sourceLogic": "<name of similar argumentative structure>", "pointOfSimilarity": "<explanation of similar logical flow>" }]
  },
  "questions": ["<Question about the main thesis>", "<Question about the evidence used>", "<Question about potential counterarguments>"]
}
`;

// [유형 3] 소감문/리뷰 분석용 프롬프트
const promptForReflection = `
Analyze the user's reflection/review based on authenticity and expression. Provide a balanced report in JSON format, in Korean.
Focus on textual similarity (direct copy & paraphrasing). Structural analysis is less important here.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT. Do not include markdown or any text outside the JSON.

**JSON STRUCTURE:**
{
  "documentType": "reflection",
  "originalityScore": <Number 0-100 for expressive originality. High score = less generic.>,
  "overallAssessment": "<One-paragraph assessment of the reflection's authenticity and expressive quality.>",
  "judgmentCriteria": ["표현의 진정성", "경험의 구체성", "텍스트 유사도"],
  "plagiarismReport": {
    "directPlagiarism": [{ "similarSentence": "<found sentence>", "source": "<estimated source>", "similarityScore": <number> }],
    "structuralPlagiarism": []
  },
  "questions": ["<Question to elicit deeper personal insight>", "<Question about a specific expression used>", "<Question about connecting the experience to a broader context>"]
}
`;


// 4. Vercel 서버리스 함수 (핵심 로직)
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { stage, docType, idea, originalIdea, answers } = req.body;

        let prompt = "";
        
        // 'stage'에 따라 적절한 프롬프트와 입력 데이터 할당
        if (stage === 'analyze') {
            if (!idea || !docType) return res.status(400).json({ error: 'Missing idea or docType.' });
            
            // docType에 따라 다른 프롬프트 선택
            switch(docType) {
                case 'idea':
                    prompt = promptForIdea;
                    break;
                case 'essay':
                    prompt = promptForEssay;
                    break;
                case 'reflection':
                    prompt = promptForReflection;
                    break;
                default:
                    return res.status(400).json({ error: 'Invalid docType.' });
            }
            
            const result = await model.generateContent(`${prompt}\n\n[User's Text]:\n${idea}`);
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
                return res.status(200).json(analysisResultJson);
            } catch (e) {
                console.error("JSON Parsing Error:", e.message);
                console.error("Original AI Response:", analysisResultText); 
                throw new Error(`AI가 유효하지 않은 JSON 형식으로 응답했습니다.`);
            }

        } else if (stage === 'fuse') {
            // 2단계 융합 로직은 모든 문서 유형에 공통적으로 적용될 수 있음 (필요시 이 부분도 분기)
            if (!originalIdea || !answers) return res.status(400).json({ error: 'Missing originalIdea or answers.' });
            
            const fusePrompt = `You are a creative strategist. Synthesize the [Original Idea] and [User's Answers] into a 'Fused Idea'. Incorporate the user's answers to evolve the original concept. Be concise and fast, in Korean. **JSON OUTPUT RULES:** Respond with a valid JSON object without markdown. **JSON STRUCTURE:** { "fusionTitle": "<...>", "fusionSummary": "<...>", "connection": "<...>", "keyFeatures": ["<...>", "<...>", "<...>"] }`;
            const result = await model.generateContent(`${fusePrompt}\n\n[Original Idea]:\n${originalIdea}\n\n[User's Answers]:\n${answers.join('\n')}`);
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
                return res.status(200).json(analysisResultJson);
            } catch (e) {
                 console.error("JSON Parsing Error:", e.message);
                console.error("Original AI Response:", analysisResultText); 
                throw new Error(`AI가 유효하지 않은 JSON 형식으로 응답했습니다.`);
            }
        
        } else {
            return res.status(400).json({ error: 'Invalid stage provided.' });
        }

    } catch (error) {
        console.error('AI 분석 중 오류:', error);
        res.status(500).json({ error: error.message || 'AI 모델을 호출하는 데 실패했습니다.' });
    }
};

