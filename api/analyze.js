// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY' 가져오기
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest", 
});

// --- 프롬프트 엔지니어링 (JSON 출력 강화) ---

// [1단계] 분석 및 질문 생성용 프롬프트
const promptForStep1 = `
You are an expert AI analyst for PI-Fuze. Your task is to analyze a user's idea and return a response ONLY in a valid JSON format. Do not include any text before or after the JSON object.

The user's idea is:
---
{{IDEA}}
---

Analyze this idea and generate a JSON object with the following structure:
{
  "plagiarismScore": <A number between 0 and 100 representing the risk of structural plagiarism. Higher means more common.>,
  "plagiarismReason": "<A brief, one-sentence explanation for the score. e.g., '매우 보편적인 시장 진입 전략입니다.'>",
  "archetype": {
    "name": "<The name of the closest idea archetype. e.g., '소셜 네트워크 기반 마켓플레이스'>",
    "description": "<A one-sentence description of this archetype.>",
    "comparison": "<A common, real-world example of this archetype. e.g., '당근마켓, 중고나라와 같이 사용자를 먼저 모으고 거래 기능을 붙이는 방식'>"
  },
  "questions": [
    "<A thought-provoking question to challenge the user's core assumption.>",
    "<A second question to inspire a creative fusion with another field.>",
    "<A third question to make the user think about a niche target audience.>"
  ]
}
`;

// [2단계] 최종 융합 아이디어 생성용 프롬프트
const promptForStep2 = `
You are an expert creative strategist for PI-Fuze. Your task is to synthesize a final, fused idea based on the user's original idea and their answers to your questions. Return a response ONLY in a valid JSON format. Do not include any text before or after the JSON object.

The user's original idea was:
---
{{ORIGINAL_IDEA}}
---

The user's answers to the provocative questions are:
---
1. {{ANSWER_1}}
2. {{ANSWER_2}}
3. {{ANSWER_3}}
---

Synthesize this information and generate a JSON object with the following structure:
{
  "fusionTitle": "<A catchy, new name for the fused idea.>",
  "fusionSummary": "<A compelling one-paragraph summary of the new idea.>",
  "connection": "<A brief explanation of how the user's answers were specifically used to evolve the original idea into this new concept.>",
  "keyFeatures": [
    "<The first key feature of the new idea.>",
    "<The second key feature, directly reflecting the fusion.>",
    "<The third key feature, highlighting its uniqueness.>"
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
        let finalPrompt = "";

        if (stage === 'analyze') {
            finalPrompt = promptForStep1.replace('{{IDEA}}', idea);
        } else if (stage === 'fuse') {
            finalPrompt = promptForStep2
                .replace('{{ORIGINAL_IDEA}}', originalIdea)
                .replace('{{ANSWER_1}}', answers[0])
                .replace('{{ANSWER_2}}', answers[1])
                .replace('{{ANSWER_3}}', answers[2]);
        } else {
            return res.status(400).json({ error: 'Invalid stage provided.' });
        }

        const result = await model.generateContent(finalPrompt);
        const responseText = result.response.text();
        
        // AI 응답이 유효한 JSON인지 확인하기 위한 파싱
        try {
            const jsonResponse = JSON.parse(responseText);
            res.status(200).json(jsonResponse);
        } catch (e) {
            console.error("JSON Parsing Error:", e);
            console.error("Original AI Response:", responseText);
            res.status(500).json({ error: "AI가 유효한 형식의 응답을 생성하지 못했습니다." });
        }

    } catch (error) {
        console.error('AI 분석 중 오류:', error);
        res.status(500).json({ error: 'AI 모델을 호출하는 데 실패했습니다.' });
    }
};

