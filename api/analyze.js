// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY' 가져오기
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AI 모델 설정 (사용자가 찾아낸 모델)
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});


// --- 프롬프트 엔지니어링 ---

// [1단계] 최초 아이디어 분석 및 질문 생성용 프롬프트
const promptForStep1 = `
You are an expert AI consultant specializing in innovation and intellectual property analysis.
Your task is to analyze a user's idea and provide a structured, balanced report in JSON format.
You must not label everything as plagiarism. Instead, perform a nuanced analysis by finding a real-world parallel and highlighting both similarities and creative differences.

**Analysis Criteria:**
When analyzing, consider these three core criteria:
1.  **Originality of Problem Definition:** How unique is the core problem the user is trying to solve?
2.  **Novelty of Solution Approach:** Is the method or technology used to solve the problem new or applied in a new way?
3.  **Differentiation of Value Proposition:** How distinct is the benefit offered to the target audience compared to existing solutions?

**JSON Output Structure:**
Based on your analysis, you MUST generate a JSON object with the following exact structure. Do not include any text, markdown formatting, or explanations outside of the JSON object.

\`\`\`json
{
  "plagiarismScore": <A number between 0 and 100 representing the risk of structural plagiarism. High score means high similarity to existing ideas.>,
  "plagiarismReason": "<A brief, one-sentence explanation for the score. Example: 'The core concept of a niche marketplace is well-established, but the target audience provides some differentiation.'>",
  "archetype": {
    "name": "<A short, descriptive name for the structural pattern of the idea. Example: 'Vertical E-commerce Platform'>",
    "description": "<A one-sentence description of this archetype. Example: 'This is a specialized online platform that focuses on transactions and exhibitions for a specific category of goods.'>",
    "comparison": "<A well-known, real-world example that fits this archetype. Example: 'Just as Etsy specializes in handmade goods or KREAM specializes in limited-edition sneakers, this idea creates a dedicated space for a specific artistic field.'>"
  },
  "questions": [
    "<A probing question that challenges the user's core assumptions based on the analysis.>",
    "<A second question that encourages the user to think about expanding the idea's scope or interactivity.>",
    "<A third question that pushes the user to consider a more specific niche market or application.>"
  ]
}
\`\`\`
`;


// [2단계] 답변을 받아 최종 융합 아이디어 생성용 프롬프트
const promptForStep2 = `
You are a master creative strategist.
You have been given a user's [Original Idea] and their [User's Answers] to questions designed to expand that idea.

Your mission is to synthesize this information into a single, concrete, and innovative 'Fused Idea'.
You MUST actively incorporate the user's answers to evolve the original concept.

**JSON Output Structure:**
Generate a JSON object with the following exact structure. Do not include any text, markdown formatting, or explanations outside of the JSON object.

\`\`\`json
{
  "fusionTitle": "<A compelling, new name for the fused idea.>",
  "fusionSummary": "<A concise, one-paragraph summary of the final fused idea, explaining what it is.>",
  "connection": "<Explain how the user's answers transformed the original idea into this new concept. Reference specific answers. Example: 'The user's answer to the first question shifted the focus from a simple marketplace to an educational platform...'>",
  "keyFeatures": [
    "<A description of the first key feature of the fused idea.>",
    "<A description of the second key feature.>",
    "<A description of the third key feature.>"
  ]
}
\`\`\`
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
        // AI might sometimes include ```json ... ``` markdown. We need to extract the raw JSON.
        const jsonMatch = analysisResultText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            analysisResultText = jsonMatch[1];
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

