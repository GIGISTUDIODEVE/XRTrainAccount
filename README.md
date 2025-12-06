# XRTrainAccount

## Unity 콘텐츠 완료 테스트 안내
Unity 스크립트(`unity/ContentCompletionTester.cs`)로 콘텐츠 완료 페이로드를 전송할 때 다음 흐름을 사용할 수 있습니다.

### 1) Unity → Firebase Functions (권장)
- 스크립트에서 `useFirebaseFunctionUrl`을 활성화하고 프로젝트 ID/리전을 입력합니다.
- Unity가 HTTPS Functions 엔드포인트(예: `https://asia-northeast3-<project>.cloudfunctions.net/<function>`)로 직접 전송합니다.
- Functions에서 Firestore에 기록 후 응답을 반환합니다.

### 2) Unity → Firebase Hosting → Functions → Unity (Hosting 리라이트)
- Firebase Hosting의 `firebase.json`에 `"rewrites": [{"source": "/api/**", "function": "<function>"}]` 형태로 설정합니다.
- 스크립트에서 `useFirebaseHostingRewrite`를 활성화하고 Hosting 도메인(`https://<project>.web.app`)과 리라이트 경로(`/api/contents/complete` 등)를 입력합니다.
- Hosting이 요청을 Functions로 프록시하며, Functions 응답에 CORS 헤더(`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`)를 설정해야 Unity에서 응답을 받을 수 있습니다.
- GitHub Pages 같은 정적 호스팅은 POST 프록시를 지원하지 않으므로 Firebase Hosting/Cloud Functions 조합을 사용해야 합니다.

### 3) Unity → 기타 API 서버 → Firebase
- `apiUrl`만 직접 설정해 별도 백엔드로 전송할 수도 있습니다.

## 테스트
프로젝트에는 Node/npm이 없으므로 `npm test` 실행은 실패할 수 있습니다.

## 콘텐츠 완료 테스트 페이지
- `content-test.html`을 열어 Firestore `contents` 컬렉션에 테스트 레코드를 직접 작성할 수 있습니다.
- 필요 시 이메일/비밀번호로 로그인 후 관리자 UID, 참가자 UID, 시나리오 정보와 미션 결과를 입력하고 저장하면 됩니다.
- 예상 질문/답변은 각 미션당 최대 3개까지 추가할 수 있으며 저장 결과는 페이지 하단 로그 패널에서 확인할 수 있습니다.
