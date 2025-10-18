// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY' 가져오기
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});


// --- 프롬프트 엔지니어링 (속도 최적화) ---

// [1단계] 최초 아이디어 분석 및 질문 생성용 프롬프트 (유사성 분석 추가)
const promptForStep1 = `
Analyze the user's idea. Provide a balanced report in JSON format.
Find a real-world parallel and highlight similarities and differences.
**NEW TASK:** Also, conduct a 'text similarity check'. Find key phrases or sentences in the user's idea that are overly similar to common knowledge or existing products. This is to warn the user about potential lack of novelty or textual overlap.
Be concise, in korean.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID JSON OBJECT.
- Do not include markdown \`\`\`json or any text outside the JSON structure.

**JSON STRUCTURE:**
{
  "originalityScore": <Number from 0-100 for structural originality. High score = very original.>,
  "overallAssessment": "<One-paragraph assessment of the idea's originality and potential.>",
  "judgmentCriteria": [
    "문제 정의의 독창성",
    "해결 방식의 참신성",
    "가치 제안의 차별성"
  ],
  "comparisonAnalysis": {
    "existingExampleName": "<Name of a similar real-world service.>",
    "existingExampleDesc": "<One-sentence description of the existing service.>",
    "pointsOfSimilarity": "<Explain structural similarities with the existing service.>",
    "pointsOfDifference": "<Explain creative differences and unique points of the user's idea.>"
  },
  "similarityReport": {
     "highlySimilarPhrases": [
       "<Analyze the user's idea text and list key phrases or sentences that are highly similar to well-known concepts or existing materials. If none, return an empty array [].>"
     ],
     "reportSummary": "<A brief one-sentence summary about the textual similarity. (e.g., '일부 핵심 용어가 기존 솔루션과 겹치지만, 전반적인 구조는 독창적입니다.' or '제시된 아이디어의 핵심 문구가 [유사사례]와 매우 흡사하여 주의가 필요합니다.')>"
  },
  "questions": [
    "<A question challenging the user's core assumptions.>",
    "<A question to expand the idea's scope.>",
    "<A question to consider a more specific niche market.>"
  ]
}
`;


// [2단계] 답변을 받아 최종 융합 아이디어 생성용 프롬프트 (간결화 버전)
const promptForStep2 = `
You are a creative strategist. Synthesize the [Original Idea] and [User's Answers] into a 'Fused Idea'.
Incorporate the user's answers to evolve the original concept.
Be concise and fast.

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
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { stage, idea, originalIdea, answers } = req.body;

        let prompt = "";
        let userInput = "";
        
        if (stage === 'analyze') {
            prompt = promptForStep1;
            userInput = `Here is the user's idea:\n${idea}`;
        } else if (stage === 'fuse') {
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
        // 프롬프트에서 JSON 마크다운을 쓰지 말라고 했지만, 만약을 대비한 방어 코드
        const jsonMatch = analysisResultText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            analysisResultText = jsonMatch[1];
        }

        // AI 응답이 JSON 형식이 아닐 수 있는 문제를 방지하기 위해 텍스트 시작/끝의 중괄호를 기준으로 파싱 시도
        const firstBrace = analysisResultText.indexOf('{');
        const lastBrace = analysisResultText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
             analysisResultText = analysisResultText.substring(firstBrace, lastBrace + 1);
        }

        try {
            const analysisResultJson = JSON.parse(analysisResultText);
            res.status(200).json(analysisResultJson);
        } catch (e) {
            console.error("JSON Parsing Error:", e);
            console.error("Original AI Response:", analysisResultText);
            throw new Error(`AI가 유효하지 않은 JSON 형식으로 응답했습니다.`);
        }

    } catch (error) {
        console.error('AI 분석 중 오류:', error);
        let errorMessage = 'AI 모델을 호출하는 데 실패했습니다.';
        if (error.message) {
            errorMessage = error.message;
        }
        res.status(500).json({ error: errorMessage });
    }
};
