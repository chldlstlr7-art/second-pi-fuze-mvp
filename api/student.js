// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 모든 Gemini API 키 가져오기
const apiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY2,
].filter(key => key);

if (apiKeys.length < 2) {
    throw new Error("병렬 처리를 위해 GEMINI_API_KEY와 GEMINI_API_KEY2 환경 변수가 모두 설정되어야 합니다.");
}

const genAI_1 = new GoogleGenerativeAI(apiKeys[0]);
const genAI_2 = new GoogleGenerativeAI(apiKeys[1]);

// 3. 각기 다른 모델 인스턴스 설정
const model_1 = genAI_1.getGenerativeModel({ model: "gemini-2.5-flash" });
const model_2 = genAI_2.getGenerativeModel({ model: "gemini-2.5-flash" });


// --- 프롬프트 엔지니어링 (업무 재분배 및 고도화) ---

// [작업 1] 개념/구조 분석 프롬프트
const promptForConceptualAnalysis = `
You are an expert AI consultant. Your first task is to perform a conceptual and structural analysis of the user's text.
First, classify the text into ONE of the following three categories: 'Creative Thinking & Writing', 'Argument & Logic', or 'Innovation & Business'.
Then, provide a detailed analysis including raw scores for calculating originality. Be extremely fast and concise. Output JSON in Korean.

**Structural Plagiarism Rule (Crucial):**
- Do NOT flag generic writing formats (e.g., 'compare/contrast essay').
- Only report structural plagiarism if the SUBSTANTIVE LOGICAL FLOW within the SAME OR A VERY SIMILAR TOPIC is nearly identical to a specific source.

**JSON OUTPUT RULES:**
- Respond with a VALID JSON object without any markdown wrappers.

**JSON STRUCTURE:**
{
  "documentType": "<The category you identified: '창의적 사고와 글쓰기', '주장과 논리', or '혁신과 비즈니스'>",
  "coreSummary": ["<1st key logic/sentence>", "<2nd key>", "<3rd key>"],
  "logicFlowchart": "<A -> B -> C>",
  "judgmentCriteria": ["<Criterion 1>", "<Criterion 2>", "<Criterion 3>"],
  "structuralComparison": {
    "sourceName": "<Name of the similar real-world example>",
    "sourceLogic": "<Briefly describe the logic of the example>",
    "topicalSimilarity": <Number 0-100 for topic similarity>,
    "structuralSimilarity": <Number 0-100 for structural similarity>,
    "originalityReasoning": "<Explain the reasoning for the scores, referencing the flowchart and comparison.>"
  },
  "questions": ["<...>", "<...>", "<...>"]
}
`;

// [작업 2] 텍스트 표절 분석 프롬프트
const promptForTextualAnalysis = `
You are a plagiarism detection specialist. Your ONLY task is to analyze the user's text for direct textual similarities from your internal knowledge.
Be extremely fast and concise. Output JSON in Korean.
**Rules:** You MUST report ALL instances with a similarityScore >= 90%, including both 'userSentence' and 'originalSentence'. Respond with a VALID JSON object without markdown wrappers.
**JSON STRUCTURE:**
{
  "plagiarismSuspicion": [{ "userSentence": "<The exact sentence from user's text>", "originalSentence": "<The original sentence from the source>", "source": "<Estimated original source>", "similarityScore": <Number> }]
}
`;

// [작업 3] 최종 융합 아이디어 생성용 프롬프트
const promptForStep2 = `
You are a creative strategist. Synthesize the [Original Idea] and [User's Answers] into a 'Fused Idea'.
Provide a concise analysis and concrete, actionable edit suggestions. Output JSON in Korean.
**JSON OUTPUT RULES:** Respond with a VALID JSON object without markdown.
**JSON STRUCTURE:**
{
  "fusionTitle": "<...>", "analysis": { "originalSummary": "<...>", "keyChange": "<...>", "conclusion": "<...>" },
  "suggestedEdits": [{ "originalText": "<...>", "suggestedRevision": "<...>" }]
}
`;

// --- Helper function to safely parse JSON ---
function safeJsonParse(text) {
    try {
        let parsableText = text.replace(/```json|```/g, '');
        const firstBrace = parsableText.indexOf('{');
        const lastBrace = parsableText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            parsableText = parsableText.substring(firstBrace, lastBrace + 1);
        }
        return JSON.parse(parsableText);
    } catch (e) {
        console.error("JSON Parsing Error:", e.message, "Original Text:", text);
        return null;
    }
}

// Vercel 서버리스 함수
module.exports = async (req, res) => {
    console.time("Total Request Time"); 
    if (req.method !== 'POST') {
        console.timeEnd("Total Request Time");
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { stage, idea, originalIdea, answers } = req.body;
        let finalResultJson;

        if (stage === 'analyze') {
            if (!idea) { console.timeEnd("Total Request Time"); return res.status(400).json({ error: 'Missing idea.' }); }
            
            console.time("Parallel API Calls");
            const conceptualPromise = model_1.generateContent(`${promptForConceptualAnalysis}\n\n[User's Text]:\n${idea}`).then(r => r.response.text());
            const textualPromise = model_2.generateContent(`${promptForTextualAnalysis}\n\n[User's Text]:\n${idea}`).then(r => r.response.text());
            
            const results = await Promise.allSettled([conceptualPromise, textualPromise]);
            console.timeEnd("Parallel API Calls");

            if (results[0].status === 'rejected' || results[1].status === 'rejected') {
                throw new Error("AI 분석 작업 중 하나 이상이 실패했습니다.");
            }
            
            const conceptualJson = safeJsonParse(results[0].value);
            const textualJson = safeJsonParse(results[1].value);

            if (!conceptualJson || !textualJson) { throw new Error("AI 응답을 JSON으로 변환하는 데 실패했습니다."); }
            
            // 두 결과를 하나의 최종 JSON 객체로 병합
            finalResultJson = {
                documentType: conceptualJson.documentType,
                coreSummary: conceptualJson.coreSummary,
                logicFlowchart: conceptualJson.logicFlowchart,
                judgmentCriteria: conceptualJson.judgmentCriteria,
                structuralComparison: conceptualJson.structuralComparison,
                questions: conceptualJson.questions,
                plagiarismReport: {
                    plagiarismSuspicion: textualJson.plagiarismSuspicion || [],
                }
            };
            
        } else if (stage === 'fuse') {
            if (!originalIdea || !answers) { console.timeEnd("Total Request Time"); return res.status(400).json({ error: 'Missing originalIdea or answers.' }); }
            
            console.time("API Call: Fusion");
            const result = await model_1.generateContent(`${promptForStep2}\n\n[Original Idea]:\n${originalIdea}\n\n[User's Answers]:\n${answers.join('\n')}`);
            finalResultJson = safeJsonParse(result.response.text());
            console.timeEnd("API Call: Fusion");
        
        } else {
            console.timeEnd("Total Request Time");
            return res.status(400).json({ error: 'Invalid stage provided.' });
        }

        if (!finalResultJson) { throw new Error("최종 결과 생성에 실패했습니다."); }
        
        console.timeEnd("Total Request Time");
        res.status(200).json(finalResultJson);

    } catch (error) {
        console.error('AI 분석 중 오류:', error);
        console.timeEnd("Total Request Time");
        res.status(500).json({ error: error.message || 'AI 모델을 호출하는 데 실패했습니다.' });
    }
};

