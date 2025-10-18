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


// --- 프롬프트 엔지니어링 (역할 분리) ---

// [작업 1] 창의성 분석 및 질문 생성용 프롬프트
const promptForAnalysisAndQuestions = `
You are an expert AI consultant. First, classify the user's text into 'idea', 'essay', or 'reflection'.
Then, provide an originality analysis and probing questions based on that type.
Be extremely fast and concise. Output JSON in Korean.
**JSON OUTPUT RULES:** Respond with a VALID JSON object without any markdown wrappers.
**JSON STRUCTURE:**
{
  "documentType": "<'아이디어/기획안', '논설문/에세이', or '소감문/리뷰'>",
  "logicalOriginalityScore": <Number 0-100>,
  "coreSummary": ["<1st key logic/sentence>", "<2nd key logic/sentence>", "<3rd key logic/sentence>"],
  "judgmentCriteria": ["<Criterion 1>", "<Criterion 2>", "<Criterion 3>"],
  "questions": ["<...>", "<...>", "<...>"]
}
`;

// [작업 2] 표절 검사 전용 프롬프트
const promptForPlagiarismReport = `
You are a plagiarism detection specialist. Analyze the user's text for direct and structural plagiarism.
Be extremely fast and concise. Output JSON in Korean.
**Plagiarism Rules:** Differentiate 'plagiarismSuspicion' from 'properCitation'. Do NOT flag generic formats. Use internal knowledge for sources, NOT web search (set sourceLink to ""). Report all suspicions with similarityScore >= 80%.
**JSON OUTPUT RULES:** Respond with a VALID JSON object without any markdown wrappers.
**JSON STRUCTURE:**
{
  "textPlagiarismScore": <Number 0-100 for textual plagiarism risk>,
  "plagiarismReport": {
    "plagiarismSuspicion": [{ "similarSentence": "<...>", "source": "<...>", "similarityScore": <...> }],
    "properCitation": [{ "citedSentence": "<...>", "source": "<...>" }],
    "commonKnowledge": ["<list of common knowledge phrases found>"],
    "structuralPlagiarism": [{ "sourceLogic": "<...>", "pointOfSimilarity": "<...>", "similarityLevel": "<...>", "sourceLink": "" }]
  }
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
        return null; // Return null on parsing failure
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

            // 두 개의 작업을 독립적인 함수로 정의
            const runCreativityAnalysis = async () => {
                console.time("Creativity Task");
                const result = await model_1.generateContent(`${promptForAnalysisAndQuestions}\n\n[User's Text]:\n${idea}`);
                console.timeEnd("Creativity Task");
                return result.response.text();
            };

            const runPlagiarismAnalysis = async () => {
                console.time("Plagiarism Task");
                const result = await model_2.generateContent(`${promptForPlagiarismReport}\n\n[User's Text]:\n${idea}`);
                console.timeEnd("Plagiarism Task");
                return result.response.text();
            };

            // Promise.allSettled를 사용하여 두 작업이 모두 완료될 때까지 기다림 (성공/실패 무관)
            const results = await Promise.allSettled([
                runCreativityAnalysis(),
                runPlagiarismAnalysis()
            ]);
            
            console.timeEnd("Parallel API Calls");

            const analysisResult = results[0];
            const plagiarismResult = results[1];

            // 두 작업 모두 성공했는지 확인
            if (analysisResult.status === 'rejected' || plagiarismResult.status === 'rejected') {
                console.error("Analysis Task Error:", analysisResult.reason);
                console.error("Plagiarism Task Error:", plagiarismResult.reason);
                throw new Error("AI 분석 작업 중 하나 이상이 실패했습니다.");
            }
            
            // 각 결과를 안전하게 파싱
            const analysisJson = safeJsonParse(analysisResult.value);
            const plagiarismJson = safeJsonParse(plagiarismResult.value);

            if (!analysisJson || !plagiarismJson) {
                throw new Error("AI 응답을 JSON으로 변환하는 데 실패했습니다.");
            }
            
            // 두 결과를 하나의 객체로 병합
            finalResultJson = { ...analysisJson, ...plagiarismJson };
            
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

