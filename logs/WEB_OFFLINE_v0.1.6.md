# Web Offline v0.1.6

- 기록일: 2026-11-05
- 변경: 웹 프로토타입 직접 열기 지원

## 변경 내용

- `web/index.html`을 `file://`로 직접 열 수 있도록 ES Module 의존성을 제거했다.
- 브라우저용 일반 스크립트 `web/src/game.js`, `web/src/main.js`를 추가했다.
- 외부 아이콘 CDN과 Google Fonts 의존성을 제거하고 로컬 HTML 문자로 대체했다.
- 기존 정적 서버 실행 방식과 `web/src/game.mjs` 기반 테스트는 유지했다.

## 검증

- `node --test web/tests/game.test.mjs`
- `node --check web/src/game.js`
- `node --check web/src/main.js`
- `node --check web/src/main.mjs`
- `git diff --check`

## 알려진 제한사항

- 자동 브라우저 검증은 브라우저 보안 정책상 `file://` URL 접근이 차단되어 실행하지 못했다.
