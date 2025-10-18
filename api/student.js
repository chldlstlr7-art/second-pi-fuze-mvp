// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY' 가져오기
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AI 모델 설정
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});


// --- 프롬프트 엔지니어링 (학생용) ---

// [1단계] 학생용: 최초 아이디어 분석 및 질문 생성용 프롬프트 (고도화 버전)
const promptForStep1 = `
You are an expert AI consultant specializing in innovation and intellectual property analysis.
Your task is to analyze a user's idea and provide a structured, balanced report in JSON format, in Korean.
You must not label everything as plagiarism. Instead, perform a nuanced analysis by finding a real-world parallel and highlighting both similarities and creative differences.
Your analysis must distinguish between 'Direct Plagiarism (text similarity)' and 'Structural Plagiarism (logic similarity)'.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID KOREAN JSON OBJECT.
- Do not include markdown \`\`\`json or any text outside the JSON structure.
- If no plagiarism of a certain type is found, return an empty array [] for that key.

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
    "existingExampleDesc": "<One-sentence description of the existing service.>"
  },
  "plagiarismReport": {
    "directPlagiarism": [
      {
        "source": "<The name of the source material (e.g., 'Wikipedia article on AI'). If unknown, state '일반 상식' or '보편적 표현'.>",
        "similarSentence": "<The specific sentence from the user's idea that is too similar.>",
        "similarityScore": <A percentage number (0-100) indicating the textual similarity.>
      }
    ],
    "structuralPlagiarism": [
      {
        "sourceLogic": "<A description of the logic/structure from an existing idea or field.>",
        "pointOfSimilarity": "<The specific aspect where the logic is similar (e.g., '사용자 보상 시스템', '데이터 분석을 통한 개인화 추천 로직').>"
      }
    ]
  },
  "questions": [
    "<A question challenging the user's core assumptions.>",
    "<A question to expand the idea's scope.>",
    "<A question to consider a more specific niche market.>"
  ]
}
`;


// [2단계] 학생용: 답변을 받아 최종 융합 아이디어 생성용 프롬프트
const promptForStep2 = `
You are a creative strategist. Synthesize the [Original Idea] and [User's Answers] into a 'Fused Idea'.
Incorporate the user's answers to evolve the original concept.
Be concise and fast, in Korean.

**JSON OUTPUT RULES:**
- YOU MUST RESPOND WITH A VALID KOREAN JSON OBJECT.
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


// 4. Vercel 서버리스 함수 (학생용 로직)
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
            userInput = `Here is the user's idea:\n${idea}`;
        } else if (stage === 'fuse') {
            if (!originalIdea || !answers) return res.status(400).json({ error: 'Missing originalIdea or answers.' });
            prompt = promptForStep2;
            userInput = `[Original Idea]:\n${originalIdea}\n\n[User's Answers]:\n${answers.join('\n')}`;
        } else {
            return res.status(400).json({ error: 'Invalid stage provided (must be analyze or fuse).' });
        }
        
        const fullPrompt = `${prompt}\n\n${userInput}`;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        let analysisResultText = response.text();

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
        let errorMessage = 'AI 모델을 호출하는 데 실패했습니다.';
        if (error.message) {
            errorMessage = error.message;
        }
        res.status(500).json({ error: errorMessage });
    }
};
