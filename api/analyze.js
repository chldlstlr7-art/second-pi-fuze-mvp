// 1. OpenAI 대신 Google Gemini 라이브러리를 가져옵니다.
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장할 'GEMINI_API_KEY'를 가져옵니다.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. PI-Fuze의 시스템 프롬프트 (기존과 동일)
const systemPrompt = `
    당신은 서울대학교의 지능형 교육 조교(AI-TA) 'PI-Fuze'입니다.
    당신의 임무는 학생의 아이디어를 분석하여 단순 표절을 넘어 '논리 구조나 핵심 아이디어의 구조적 복제' 가능성을 진단하고, 창의적 사고를 증진시키는 것입니다.

    다음 3단계 프로세스에 따라 응답을 생성해주세요:

    1.  **[1단계: 독창성 진단]**:
        * 제출된 아이디어의 핵심 '아이디어 원형(Archetype)'을 분석합니다.
        * 이 아이디어가 학계나 산업계에서 흔히 발견되는 구조(구조적 복제)인지, 독창성이 부족한 원인(예: 관점 협소, 가정 고정)이 무엇인지 진단합니다.

    2.  **[2단계: 메타인지적 도발]**:
        * 진단된 원인을 해결하기 위해, 학생의 사고를 자극하는 '도발적인 질문' 3가지를 생성합니다.
        * 이 질문은 학생의 고정된 가정을 깨고 문제를 재정의하도록 유도해야 합니다.

    3.  **[3단계: 융합 경로 제안]**:
        * 학생의 초기 아이디어를 발전시킬 수 있는 독창적인 '융합 아이디어 경로' 2가지를 구체적으로 제시합니다.
        * 전혀 다른 학문 분야와의 융합이나 역설적인 해법을 포함해야 합니다.

    응답은 명확하게 Markdown 형식을 사용하고, 각 단계를 제목(##)으로 구분해주세요.
`;

// 4. Vercel 서버리스 함수
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { idea } = req.body;
        if (!idea) {
            return res.status(400).json({ error: '아이디어를 입력해주세요.' });
        }

        // 5. Gemini 모델을 설정합니다. (시스템 프롬프트 포함)
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-pro-latest", // 강력한 최신 모델
            systemInstruction: systemPrompt,
        });

        // 6. 채팅 세션을 시작하고 사용자 아이디어를 보냅니다.
        const chat = model.startChat();
        const result = await chat.sendMessage(idea); // 'idea'가 사용자 프롬프트
        const response = await result.response;
        const analysisResult = response.text();

        // 7. 결과를 프론트엔드로 전송합니다.
        res.status(200).json({ analysis: analysisResult });

    } catch (error) {
        console.error('AI 분석 중 오류:', error);
        // Gemini에서 할당량 초과 시 '429' 오류를 다르게 보낼 수 있습니다.
        if (error.message && error.message.includes('429')) {
            res.status(429).json({ error: 'Gemini 무료 할당량을 초과했습니다. 잠시 후 시도해주세요.' });
        } else {
            res.status(500).json({ error: 'AI 모델을 호출하는 데 실패했습니다.' });
        }
    }
};
