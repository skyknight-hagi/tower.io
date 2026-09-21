# UPDATE

작업이 끝날 때마다 **맨 위**에 날짜 항목을 추가합니다.
한 줄 요약 + 무엇을 바꿨는지 + 다음에 알면 좋은 점.

---

## 2026-09-21 — 25스테이지 / 글자 가독성

챕터당 웨이브를 10에서 25로 늘리고, HUD·상점·메뉴 글자를 키움.

- `WAVES_PER_CHAPTER = 25`. 10/15/20/25에 보스. 후반 체력·속도 스케일을 25웨이브 길이에 맞게 완화.
- 시작 골드 190. 클리어 판정은 `waves.length` 기준.
- 타입 스케일 상향, 본문 16px·weight 600, muted 대비 강화. 벤치를 4열로 바꿔 이름·성급이 읽히게 함.
- README 스테이지 수 수정.

## 2026-09-21 — README

`README.md`를 게임 소개·조작·타워 표·로컬 실행 방법으로 다시 씀.

- 기존 파일은 UTF-16 `# tower.io` 한 줄이라 GitHub/에디터에서 깨졌음.
- UTF-8로 바꾸고, 챕터/머지/상점 잠금, Windows에서 `npm.cmd` 쓰는 방법을 넣음.

## 2026-09-21 — 세팅

로컬 세팅, E 드라이브 이전, gitignore / 첫 푸시.

- 의존성 설치 (`npm install`) 후 개발 서버가 뜨는지 확인함.
- Windows에서 `vite`가 안 뜨던 문제를 `scripts/with-app-env.mjs`에서 패키지 JS 엔트리로 실행하도록 고침.
- C 드라이브 용량 때문에 프로젝트를 `E:\김범준\Rampart`로 옮김. GitHub 원격은 `https://github.com/skyknight-hagi/tower.io.git`.
- `.gitignore` 추가 (`node_modules`, 빌드 산출물, `.grok` 로컬 파일 등).
- Prettier 설정(`.prettierrc`)과 위 수정을 `main`에 커밋·푸시함 (`06fa2b5`).
- 이후 작업은 이 파일에 이어서 기록함.

다음에 이 프로젝트를 열 때는 `E:\김범준\Rampart`를 쓰면 됨.
