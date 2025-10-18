// api/auth.js

/**
 * 이 파일은 사용자 로그인 및 세션 관리를 담당하는 API입니다.
 * 초기에는 실제 데이터베이스 없이, 들어온 사용자 정보를 그대로 반환하는 'mock' 형태로 작동합니다.
 * 향후 Firebase Firestore나 다른 데이터베이스와 연동하여 실제 사용자 데이터를 조회하도록 확장할 수 있습니다.
 */

module.exports = async (req, res) => {
    // POST 요청만 허용합니다. (로그인은 보통 POST 방식을 사용)
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // 프론트엔드에서 userId와 userType (student 또는 ta)을 받아옵니다.
        const { userId, userType } = req.body;

        // 필수 정보가 없는 경우 오류를 반환합니다.
        if (!userId || !userType) {
            return res.status(400).json({ 
                success: false, 
                message: '사용자 ID와 유형(student/ta)은 필수입니다.' 
            });
        }

        // userType이 'student' 또는 'ta'가 아닌 경우 오류를 반환합니다.
        if (userType !== 'student' && userType !== 'ta') {
            return res.status(400).json({
                success: false,
                message: '사용자 유형은 반드시 \'student\' 또는 \'ta\' 여야 합니다.'
            });
        }

        // --- 데이터베이스 연동 (미래의 확장 지점) ---
        // TODO: 이곳에 Firestore DB 로직을 추가하여,
        // 1. userId가 실제로 DB에 존재하는지 확인합니다.
        // 2. 존재한다면, 해당 사용자의 이름 등의 추가 정보를 가져옵니다.
        // ---------------------------------------------

        // 현재는 DB가 없으므로, 들어온 정보를 기반으로 가상의 사용자 데이터를 만들어 반환합니다.
        const mockUserData = {
            userId: userId,
            userName: userType === 'student' ? '융합 인재' : 'AI 조교', // DB 연동 후 실제 이름으로 대체
            userType: userType,
        };

        // 성공적으로 "로그인" 처리되었음을 프론트엔드에 알립니다.
        res.status(200).json({
            success: true,
            message: '로그인 성공',
            user: mockUserData
        });

    } catch (error) {
        console.error('인증 처리 중 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 내부 오류가 발생했습니다.' 
        });
    }
};
