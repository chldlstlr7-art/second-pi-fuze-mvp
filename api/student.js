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

// 각 작업에 다른 API 키 인스턴스를 사용
const genAI_1 = new GoogleGenerativeAI(apiKeys[0]);
const genAI_2 = new GoogleGenerativeAI(apiKeys[1]);

// 3. 각기 다른 모델 인스턴스 설정
const model_1 = genAI_1.getGenerativeModel({ model: "gemini-2.5-flash" });
const model_2 = genAI_2.getGenerativeModel({ model: "gemini-2.5-flash" });


// --- 프롬프트 엔지니어링 (업무 재분배) ---

// [작업 1] 개념/구조 분석 프롬프트
const promptForConceptualAnalysis = `
You are an expert AI consultant. Your task is to perform a conceptual and structural analysis of the user's text.
First, classify the text into 'idea', 'essay', or 'reflection'.
Then, provide an originality analysis, probing questions, and a structural plagiarism check based on that type.
Be extremely fast and concise. Output JSON in Korean.

**Rules:**
- For structural plagiarism, use internal knowledge, NOT web search.
- Do NOT flag generic formats (e.g., 'compare/contrast essay').
- Respond with a VALID JSON object without any markdown wrappers.

**JSON STRUCTURE:**
{
  "documentType": "<'아이디어/기획안', '논설문/에세이', or '소감문/리뷰'>",
  "logicalOriginalityScore": <Number 0-100 for structural originality>,
  "coreSummary": ["<1st key logic/sentence>", "<2nd key logic/sentence>", "<3rd key logic/sentence>"],
  "judgmentCriteria": ["<Criterion 1>", "<Criterion 2>", "<Criterion 3>"],
  "structuralPlagiarism": [{ "sourceLogic": "<...>", "pointOfSimilarity": "<...>", "similarityLevel": "<...>", "sourceLink": "" }],
  "questions": ["<...>", "<...>", "<...>"]
}
`;

// [작업 2] 텍스트 표절 분석 프롬프트
const promptForTextualAnalysis = `
You are a plagiarism detection specialist. Analyze the user's text for textual similarities.
Be extremely fast and concise. Output JSON in Korean.

**Rules:**
- Differentiate 'plagiarismSuspicion' (no attribution) from 'properCitation' (has quotes/source).
- Identify 'commonKnowledge' phrases.
- Report all 'plagiarismSuspicion' instances with a similarityScore >= 80%.
- Respond with a VALID JSON object without any markdown wrappers.

**JSON STRUCTURE:**
{
  "textPlagiarismScore": <Number 0-100 for textual plagiarism risk>,
  "plagiarismSuspicion": [{ "similarSentence": "<...>", "source": "<...>", "similarityScore": <...> }],
  "properCitation": [{ "citedSentence": "<...>", "source": "<...>" }],
  "commonKnowledge": ["<list of common knowledge phrases found>"]
}
`;

// [작업 3] 최종 융합 아이디어 생성용 프롬프트
const promptForStep2 = `
You are a creative strategist. Synthesize the [Original Idea] and [User's Answers] into a 'Fused Idea'.
Provide a concise analysis and concrete, actionable edit suggestions. Be extremely fast and concise. Output JSON in Korean.
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
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        let parsableText = text;
        if (jsonMatch && jsonMatch[1]) {
            parsableText = jsonMatch[1];
        } else {
            const firstBrace = parsableText.indexOf('{');
            const lastBrace = parsableText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                parsableText = parsableText.substring(firstBrace, lastBrace + 1);
            }
        }
        return JSON.parse(parsableText);
    } catch (e) {
        console.error("JSON Parsing Error:", e.message);
        console.error("Original AI Response causing error:", text);
        return null;
    }
}

// Vercel 서버리스 함수 (안정적인 병렬 처리 방식)
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
            if (!idea) {
                console.timeEnd("Total Request Time");
                return res.status(400).json({ error: 'Missing idea.' });
            }

            console.time("Parallel API Calls");

            const runConceptualAnalysis = async () => {
                console.time("Conceptual Task");
                const result = await model_1.generateContent(`${promptForConceptualAnalysis}\n\n[User's Text]:\n${idea}`);
                console.timeEnd("Conceptual Task");
                return result.response.text();
            };

            const runTextualAnalysis = async () => {
                console.time("Textual Task");
                const result = await model_2.generateContent(`${promptForTextualAnalysis}\n\n[User's Text]:\n${idea}`);
                console.timeEnd("Textual Task");
                return result.response.text();
            };

            const results = await Promise.allSettled([
                runConceptualAnalysis(),
                runTextualAnalysis()
            ]);
            
            console.timeEnd("Parallel API Calls");

            const conceptualResult = results[0];
            const textualResult = results[1];

            if (conceptualResult.status === 'rejected' || textualResult.status === 'rejected') {
                console.error("Conceptual Task Error:", conceptualResult.reason);
                console.error("Textual Task Error:", textualResult.reason);
                throw new Error("AI 분석 작업 중 하나 이상이 실패했습니다.");
            }
            
            const conceptualJson = safeJsonParse(conceptualResult.value);
            const textualJson = safeJsonParse(textualResult.value);

            if (!conceptualJson || !textualJson) {
                throw new Error("AI 응답을 JSON으로 변환하는 데 실패했습니다.");
            }
            
            // 두 결과를 하나의 최종 JSON 객체로 병합
            finalResultJson = {
                documentType: conceptualJson.documentType,
                logicalOriginalityScore: conceptualJson.logicalOriginalityScore,
                coreSummary: conceptualJson.coreSummary,
                judgmentCriteria: conceptualJson.judgmentCriteria,
                questions: conceptualJson.questions,
                textPlagiarismScore: textualJson.textPlagiarismScore,
                plagiarismReport: {
                    plagiarismSuspicion: textualJson.plagiarismSuspicion,
                    properCitation: textualJson.properCitation,
                    commonKnowledge: textualJson.commonKnowledge,
                    structuralPlagiarism: conceptualJson.structuralPlagiarism,
                }
            };
            
        } else if (stage === 'fuse') {
            if (!originalIdea || !answers) {
                console.timeEnd("Total Request Time");
                return res.status(400).json({ error: 'Missing originalIdea or answers.' });
            }
            
            console.time("API Call: Fusion");
            const fuseResult = await model_1.generateContent(`${promptForStep2}\n\n[Original Idea]:\n${originalIdea}\n\n[User's Answers]:\n${answers.join('\n')}`);
            const fuseResponse = await fuseResult.response;
            finalResultJson = safeJsonParse(fuseResponse.text());
            console.timeEnd("API Call: Fusion");
        
        } else {
            console.timeEnd("Total Request Time");
            return res.status(400).json({ error: 'Invalid stage provided.' });
        }

        if (!finalResultJson) {
            throw new Error("최종 결과 생성에 실패했습니다.");
        }
        
        console.timeEnd("Total Request Time");
        res.status(200).json(finalResultJson);

    } catch (error) {
        console.error('AI 분석 중 오류:', error);
        console.timeEnd("Total Request Time");
        res.status(500).json({ error: error.message || 'AI 모델을 호출하는 데 실패했습니다.' });
    }
};

