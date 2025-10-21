// 1. 라이브러리 및 RAG 서비스 모듈 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { searchRelevantContext } = require('./rag-service.js');

// --- 코드 내 RAG 스위치 ---
const ENABLE_RAG_IN_CODE = true; 
const isRagEnabled = process.env.ENABLE_RAG === 'true' && ENABLE_RAG_IN_CODE;

// 2. Gemini API 설정 (병렬 처리용)
const apiKeys = [ process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2 ].filter(key => key);
if (apiKeys.length < 2) { throw new Error("병렬 처리를 위해 2개의 Gemini API 키가 필요합니다."); }
const model_1 = new GoogleGenerativeAI(apiKeys[0]).getGenerativeModel({ model: "gemini-2.5-flash" });
const model_2 = new GoogleGenerativeAI(apiKeys[1]).getGenerativeModel({ model: "gemini-2.5-flash" });

// --- 프롬프트 엔지니어링 ---

// [작업 1] 개념/구조 분석 프롬프트 (RAG 비활성화 또는 폴백 시)
const promptForConceptualAnalysis = `
You are an expert AI consultant. Perform a conceptual and structural analysis of the user's text.
Provide a detailed analysis including raw scores. DO NOT generate questions.
Be extremely fast and concise. Output JSON in Korean.
**Structural Plagiarism Rule:** Only report if the SUBSTANTIVE LOGICAL FLOW within the SAME TOPIC is identical to a source. Do NOT flag generic formats.
**JSON Rules:** Respond with a VALID JSON object without markdown.
**JSON STRUCTURE:**
{
  "documentType": "일반 문서",
  "coreSummary": ["<1st key logic/sentence>", "<2nd key>", "<3rd key>"],
  "logicFlowchart": "<A -> B -> C>",
  "judgmentCriteria": ["논리 전개의 명확성", "주장의 독창성", "표현의 구체성"],
  "structuralComparison": { "sourceName": "<...>", "sourceLogic": "<...>", "topicalSimilarity": <...>, "structuralSimilarity": <...>, "originalityReasoning": "<...>" }
}
`;

// [작업 1-RAG] RAG 적용 시 사용할 프롬프트
const promptForRagConceptualAnalysis = `
You are an expert AI consultant. Based on the provided [Context], analyze the user's text.
Your structural plagiarism check MUST be based on the [Context]. DO NOT generate questions.
Output JSON in Korean.
**JSON Rules:** Respond with a VALID JSON object without markdown.
**JSON STRUCTURE:**
{
  "documentType": "RAG 기반 분석",
  "coreSummary": ["<...>", "<...>", "<...>"], "logicFlowchart": "<...>",
  "judgmentCriteria": ["참고 자료 연관성", "논리 구조의 독창성", "새로운 관점 제시"],
  "structuralComparison": { "sourceName": "<Name from Context>", "sourceLogic": "<...>", "topicalSimilarity": <...>, "structuralSimilarity": <...>, "originalityReasoning": "<Explain based on Context>" }
}
`;

// [작업 2] 텍스트 표절 분석 프롬프트
const promptForTextualAnalysis = `
You are a plagiarism detection specialist. Your ONLY task is to analyze the user's text for direct textual similarities.
Be extremely fast and concise. Output JSON in Korean.
**Rules:** Report ALL instances with similarityScore >= 90%, including 'userSentence' and 'originalSentence'. Respond with a VALID JSON object without markdown.
**JSON STRUCTURE:**
{ "plagiarismSuspicion": [{ "userSentence": "<...>", "originalSentence": "<...>", "source": "<...>", "similarityScore": <...> }] }
`;

// [작업 3] 질문 생성 전용 프롬프트
const promptForQuestions = `
Based on the user's text, generate three insightful and probing questions.
Provide the questions in a JSON format, in Korean. Be extremely fast.
**JSON OUTPUT RULES:** Respond with a VALID JSON object without markdown.
**JSON STRUCTURE:** { "questions": ["<...>", "<...>", "<...>"] }
`;

// [작업 4] 최종 융합 아이디어 생성용 프롬프트
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
            let conceptualPromise;
            
            if (isRagEnabled) {
                const context = await searchRelevantContext(idea);
                if (context && context.length > 10) {
                    console.log("RAG 문맥을 찾았습니다. RAG 기반 분석을 시작합니다.");
                    const fullPrompt = `${promptForRagConceptualAnalysis}\n\n[Context]:\n${context}\n\n[User's Text]:\n${idea}`;
                    conceptualPromise = model_1.generateContent(fullPrompt).then(r => r.response.text());
                } else {
                    console.log("유사한 문맥을 찾지 못했습니다. AI 내부 지식 기반으로 분석합니다 (Fallback).");
                    const fullPrompt = `${promptForConceptualAnalysis}\n\n[User's Text]:\n${idea}`;
                    conceptualPromise = model_1.generateContent(fullPrompt).then(r => r.response.text());
                }
            } else {
                console.log("RAG 모드가 비활성화되었습니다.");
                const fullPrompt = `${promptForConceptualAnalysis}\n\n[User's Text]:\n${idea}`;
                conceptualPromise = model_1.generateContent(fullPrompt).then(r => r.response.text());
            }

            const textualPromise = model_2.generateContent(`${promptForTextualAnalysis}\n\n[User's Text]:\n${idea}`).then(r => r.response.text());
            
            const results = await Promise.allSettled([conceptualPromise, textualPromise]);
            console.timeEnd("Parallel API Calls");

            if (results[0].status === 'rejected' || results[1].status === 'rejected') { throw new Error("AI 분석 작업 중 하나 이상이 실패했습니다."); }
            
            const conceptualJson = safeJsonParse(results[0].value);
            const textualJson = safeJsonParse(results[1].value);

            if (!conceptualJson || !textualJson) { throw new Error("AI 응답을 JSON으로 변환하는 데 실패했습니다."); }
            
            finalResultJson = {
                documentType: conceptualJson.documentType,
                coreSummary: conceptualJson.coreSummary,
                logicFlowchart: conceptualJson.logicFlowchart,
                judgmentCriteria: conceptualJson.judgmentCriteria,
                structuralComparison: conceptualJson.structuralComparison,
                // `questions`는 이 단계에서 생성하지 않으므로 포함하지 않음
                plagiarismReport: {
                    plagiarismSuspicion: textualJson.plagiarismSuspicion || [],
                }
            };

        } else if (stage === 'generate_questions') {
            if (!idea) { console.timeEnd("Total Request Time"); return res.status(400).json({ error: 'Missing idea.' }); }
            console.time("API Call: Questions");
            const result = await model_1.generateContent(`${promptForQuestions}\n\n[User's Text]:\n${idea}`);
            finalResultJson = safeJsonParse(result.response.text());
            console.timeEnd("API Call: Questions");

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

