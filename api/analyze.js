// OpenAI 라이브러리 가져오기
const { OpenAI } = require('openai');

// API 키를 환경 변수에서 안전하게 가져오기 (3단계에서 설정)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Vercel 서버리스 함수의 기본 핸들러
module.exports = async (req, res) => {
    // POST 요청이 아니면 거부
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // 프론트엔드에서 보낸 아이디어 텍스트 받기
        const { idea } = req.body;

        if (!idea) {
            return res.status(400).json({ error: '아이디어를 입력해주세요.' });
        }

        // --- PI-Fuze AI 프롬프트 엔지니어링 ---
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
        // --- 프롬프트 끝 ---

        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // AI 모델 지정
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: idea }
            ],
            temperature: 0.7,
        });

        const analysisResult = completion.choices[0].message.content;

        // 결과를 프론트엔드로 전송
        res.status(200).json({ analysis: analysisResult });

    } catch (error) {
        console.error('AI 분석 중 오류:', error);
        res.status(500).json({ error: 'AI 모델을 호출하는 데 실패했습니다.' });
    }
};
