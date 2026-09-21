# UPDATE

작업이 끝날 때마다 **맨 위**에 날짜 항목을 추가합니다.
한 줄 요약 + 무엇을 바꿨는지 + 다음에 알면 좋은 점.

---

## 2026-09-21

로컬 세팅, E 드라이브 이전, gitignore / 첫 푸시.

- 의존성 설치 (`npm install`) 후 개발 서버가 뜨는지 확인함.
- Windows에서 `vite`가 안 뜨던 문제를 `scripts/with-app-env.mjs`에서 패키지 JS 엔트리로 실행하도록 고침.
- C 드라이브 용량 때문에 프로젝트를 `E:\김범준\Rampart`로 옮김. GitHub 원격은 `https://github.com/skyknight-hagi/tower.io.git`.
- `.gitignore` 추가 (`node_modules`, 빌드 산출물, `.grok` 로컬 파일 등).
- Prettier 설정(`.prettierrc`)과 위 수정을 `main`에 커밋·푸시함 (`06fa2b5`).
- 이후 작업은 이 파일에 이어서 기록함.

다음에 이 프로젝트를 열 때는 `E:\김범준\Rampart`를 쓰면 됨.
