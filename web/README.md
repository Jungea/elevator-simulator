# 엘베 시뮬레이터 — Web Prototype

Release 0 규칙을 검증하기 위한 빌드 없는 정적 웹 프로토타입이다. `index.html`은 외부 리소스와 ES Module을 사용하지 않으므로 서버 없이 직접 열 수 있다.

## 로컬 실행

### 파일을 직접 열기

`web/index.html`을 파일 탐색기에서 더블클릭한다. 게임 저장은 브라우저의 localStorage에 기록된다.

### 정적 서버로 실행하기

```powershell
node web/tools/serve.mjs
```

브라우저에서 `http://localhost:4173`을 연다.

## 테스트

```powershell
node --test web/tests/game.test.mjs
```

## Vercel

Git 저장소를 연결한 뒤 다음과 같이 설정한다.

- Root Directory: `web`
- Framework Preset: `Other`
- Build Command: 비워 둠
- Output Directory: 비워 둠

DB와 서버는 사용하지 않는다.

