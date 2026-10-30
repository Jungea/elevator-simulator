# 엘베 시뮬레이터 — Web Prototype

Release 0 규칙을 검증하기 위한 빌드 없는 정적 웹 프로토타입이다.

## 로컬 실행

ES Module을 사용하므로 파일을 직접 열지 말고 정적 서버로 실행한다.

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

