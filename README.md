# Rampart

길을 막고, 상점에서 타워를 사고, 같은 타워를 합쳐 성급을 올린 뒤 웨이브를 버티는 타워 디펜스입니다. 저장소 이름은 `tower.io`입니다.

챕터 4개(각 25스테이지)를 클리어하면 Endless Watch가 열립니다.

## 플레이

1. **Gate Road**로 시작한다.
2. 상점에서 타워를 산 뒤, 길 옆 빈 칸에 배치한다.
3. 같은 타워 2개를 합치면 성급이 오른다. 5성 이후는 3개가 필요하다.
4. **Start wave**로 웨이브를 시작한다. 전투 중에는 배치·합치기가 가능하다.
5. 적이 길을 통과하면 라이프가 깎인다. 골드로 Heal 할 수 있다.

단축키: `Space` 웨이브 시작(준비 단계), `Esc` 일시정지/재개.

### 타워

| 이름 | 역할 |
| --- | --- |
| Bolt | 단발. 비장갑·공중 |
| Beam | 히트스캔. 단발·공중 |
| Axe | 근접 부채꼴. 지상만 |
| Blast | 폭발 범위. 지상만 |
| Hex | 슬로우· shred, 주변 타워 가속 |
| Meteor | 광역 마법. 긴 선딜 |
| Vault | 전투 중 골드 생산 |
| Keep | 병사를 소환해 지상 적을 막음 |

적 타입마다 물리 / 폭발 / Hex / 마법 배율이 다르다. 챕터 선택 화면의 표와, 적을 탭해서 나오는 정보를 보면 된다.

웨이브가 끝나면 상점을 잠글지 묻는다. Lock이면 목록을 유지하고, 아니면 다시 뽑는다.

## 실행

Node.js 22+ 가 필요하다.

```bash
npm install
npm run dev
```

Windows PowerShell에서 `npm`이 막히면 `npm.cmd run dev`를 쓴다. 브라우저에서 `http://localhost:8080` 을 연다.

```bash
npm run typecheck
npm run build
```

진행도는 브라우저 `localStorage`에 저장된다. 로그인·서버 DB는 쓰지 않는다.

## 스택

React 19, TanStack Start, Vite, Tailwind v4. 전투는 canvas 게임 루프다.
