// 1. Google Gemini 라이브러리 가져오기
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Vercel에 저장된 'GEMINI_API_KEY' 가져오기
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. AI 모델 설정 (님이 찾아낸 그 모델!)
// (주의: systemInstruction은 이 모델에서 지원하지 않을 수 있으니, 프롬프트에 직접 포함합니다.)
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
});

// --- 프롬프트 엔지니어링 ---

// [1단계] 최초 아이디어 분석 및 질문 생성용 프롬프트
const promptForStep1 = `
당신은 서울대학교의 지능형 교육 조교(AI-TA) 'PI-Fuze'입니다.
학생의 아이디어를 분석하고, 다음 3가지 항목을 **순서대로** 명확하게 제시해주세요.

1.  **[표절 위험도 진단]**
    * 제출된 아이디어의 핵심 개념을 분석하고, 일반적인 아이디어 대비 표절 위험도(구조적 복제 포함)를 '높음', '중간', '낮음'으로 평가하고 그 이유를 1-2줄로 설명합니다.

2.  **[구조적 복제의 원인]**
    * 만약 독창성이 부족하다면, 그 원인을 '관점 협소', '기존 가정 고정' 등 1-2가지 키워드로 지적합니다. (독창적이라면 '매우 독창적인 접근'이라고 칭찬합니다.)

3.  **[창의적 사고 도발 질문 (3가지)]**
    * 아이디어를 더 깊고 넓게 확장시키기 위한 '창의적 도발 질문' 3가지를 제시합니다.
    * 이 질문은 학생이 자신의 아이디어에 대해 다른 관점을 갖도록 유도해야 합니다.
    * 질문 후, "이 질문들에 대해 답변해주시면 다음 단계로 아이디어를 융합시켜 드립니다."라고 마무리 멘트를 추가해주세요.
`;

// [2단계] 답변을 받아 최종 융합 아이디어 생성용 프롬프트
const promptForStep2 = `
당신은 최고의 창의적 융합 전문가입니다.
학생의 [최초 아이디어]와 그 아이디어를 발전시키기 위한 [학생의 답변]을 받았습니다.

당신의 임무는 이 두 가지 정보를 **적극적으로 융합**하여, 매우 구체적이고, 독창적이며, 실행 가능한 **'최종 융합 아이디어'** 1가지를 제안하는 것입니다.

* 학생의 답변을 반드시 반영하여 아이디어를 발전시켜야 합니다.
* "다음은 융합 아이디어 제안입니다."라는 제목으로 시작해주세요.
* 아이디어 이름, 핵심 타겟, 주요 기능, 그리고 왜 이것이 독창적인지에 대해 구체적으로 설명해주세요.
`;


// 4. Vercel 서버리스 함수 (핵심 로직)
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // 프론트엔드에서 보낸 JSON 본문 파싱
        const { idea, originalIdea, answers } = req.body;

        let fullPrompt = "";
        
        // [1단계 요청] 최초 아이디어가 들어온 경우
        if (idea) {
            fullPrompt = `${promptForStep1}\n\n[학생의 최초 아이디어]:\n${idea}`;
        } 
        // [2단계 요청] 최초 아이디어와 답변이 함께 들어온 경우
        else if (originalIdea && answers) {
            fullPrompt = `${promptForStep2}\n\n[최초 아이디어]:\n${originalIdea}\n\n[학생의 답변]:\n${answers}`;
        } 
        // 잘못된 요청
        else {
            return res.status(400).json({ error: '잘못된 요청입니다. \'idea\' 또는 \'originalIdea\'와 \'answers\'가 필요합니다.' });
        }

        // AI 모델 호출
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const analysisResult = response.text();

        // 결과를 프론트엔드로 전송
        res.status(200).json({ analysis: analysisResult });

    } catch (error) {
        console.error('AI 분석 중 오류:', error);
        let errorMessage = 'AI 모델을 호출하는 데 실패했습니다.';
        if (error.message && error.message.includes('404')) {
            errorMessage = '모델을 찾을 수 없습니다. (404)';
        } else if (error.message && error.message.includes('429')) {
            errorMessage = '무료 할당량을 초과했습니다. (429)';
        } else if (error.message) {
            errorMessage = error.message;
        }
        res.status(500).json({ error: errorMessage });
    }
};
