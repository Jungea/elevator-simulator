# 엘베 시뮬레이터

대표만 엘리베이터에 남겨 최상층 대표실까지 모시는 2D 경로 퍼즐 게임이다.

게임 규칙은 웹 버전과 Steam 버전에서 동일하게 유지하고, 플랫폼별 표현과 실행 방식만 분리한다.

현재는 **Release 0 웹 프로토타입**을 먼저 검증하는 단계다.

## 플랫폼 구성

### Web

- HTML
- CSS
- JavaScript ES Modules
- Lucide Icons (CDN)
- 브라우저 정적 실행
- Vercel 배포
- 현재 구현 완료

### Steam / Windows

- Godot 4.x
- GDScript
- Windows Export
- Steam 배포 예정
- Godot 동기화 프로토타입 구현 중

Steam 버전은 웹 코드를 재사용하는 방식이 아니라 Godot으로 별도 구현한다. 현재 `steam/`에 동기화 프로토타입이 있으며, 게임 규칙·스테이지 구조·테스트 결과는 웹 버전과 동일하게 유지한다.

## 폴더 구조

현재 저장소:

```text
elevator-simulator/
├─ GAME_DESIGN.md             # 전체 게임 기획서
├─ README.md                  # 프로젝트 안내 문서
├─ logs/                      # 버전별 개발 로그
│  ├─ README.md
│  └─ WEB_PROTOTYPE_v0.1.0.md
│
├─ web/                       # 웹 버전 Release 0
│  ├─ index.html              # 게임 화면
│  ├─ styles.css              # UI 스타일
│  ├─ vercel.json             # Vercel 정적 배포 설정
│  ├─ README.md               # 웹 실행·배포 안내
│  ├─ src/
│  │  ├─ game.mjs             # UI와 분리된 게임 규칙
│  │  └─ main.mjs             # DOM 렌더링과 입력 처리
│  ├─ tests/
│  │  └─ game.test.mjs        # 게임 규칙 자동 테스트
│  └─ tools/
│     └─ serve.mjs            # 로컬 정적 서버
│
├─ steam/                     # 향후 Godot Steam 버전
│  ├─ project.godot
│  ├─ export_presets.cfg
│  ├─ scenes/
│  ├─ scripts/
│  ├─ data/
│  └─ assets/
│
├─ shared/                    # 향후 공통 규칙·스테이지 데이터
│  ├─ rules/
│  ├─ stages/
│  └─ test_cases/
│
├─ scripts/                   # 플랫폼별 빌드·동기화 스크립트
│
└─ builds/                    # 내보내기 결과물, Git 제외
   ├─ web/
   └─ windows/
```

`shared/`는 이후 공통 데이터 추출 시 추가한다. 현재 웹과 Godot 프로토타입은 각 플랫폼의 코드로 동일한 고정 스테이지를 구현한다.

## Release 0 웹 프로토타입

현재 구현된 규칙:

- 10층 건물
- 대표는 게임 시작부터 탑승
- 엘리베이터 정원 3명
- 숫자 키패드 조합으로 목표층 입력
- `B`는 지하층, `C`는 입력 취소
- 최대 2자리 층수 지원
- 현재 층은 선택할 수 없음
- 엘리베이터 `닫기` 버튼으로 목표층 확정 및 운행 시작
- 이동 경로 중 목적층 또는 탑승 가능한 대기층에 자동 정차
- 중간 정차 후 닫기 버튼을 눌러야 다음 층으로 이동
- 정차 처리 순서: 하차 → 상태 차감 → 게임 오버 판정 → 탑승
- 대기 중인 직원의 목적층과 상태 수치는 비공개
- 탑승 완료 직후 목적층과 상태 수치 공개
- 정원이 가득 차면 대기자만 있는 층은 통과
- 상태 수치가 0 이하가 되면 게임 오버
- 대표 혼자 10층 대표실에 도착하면 클리어

## 로컬 실행

Node.js가 설치되어 있어야 한다.

```powershell
node web/tools/serve.mjs
```

브라우저에서 다음 주소를 연다.

```text
http://127.0.0.1:4173
```

## 테스트 실행

```powershell
node --test web/tests/game.test.mjs
```

테스트는 다음 내용을 확인한다.

- 현재 층 선택 차단
- 이동 경로 자동 정차
- 목적층 직원의 선 하차
- 클리어 경로 존재
- 정원 초과 시 대기층 통과
- 상태 수치 0 이하 게임 오버

## Vercel 배포

Git 저장소를 Vercel에 연결할 때 다음과 같이 설정한다.

```text
Root Directory: web
Framework Preset: Other
Build Command: 비워 둠
Output Directory: 비워 둠
```

이 프로젝트는 별도의 빌드 프레임워크 없이 `web/` 폴더의 정적 파일을 그대로 제공한다.

CLI로 배포할 때:

```powershell
vercel deploy --cwd web
vercel deploy --prod --cwd web
```

## 데이터베이스

현재 Release 0에는 DB가 필요하지 않다.

- 계정 없음
- 로그인 없음
- 온라인 랭킹 없음
- 클라우드 저장 없음
- 고정 스테이지 데이터만 사용

플레이 상태는 브라우저 메모리에서 처리한다. 이후 다음 기능이 필요해질 때 Supabase를 검토한다.

- 계정 및 로그인
- 온라인 랭킹
- 클라우드 세이브
- 플레이 통계
- 여러 기기 진행 상황 동기화

## 아이콘

웹 UI는 단색 SVG 기반의 Lucide Icons를 사용한다. 아이콘은 CDN에서 불러오고, `data-lucide` 속성으로 렌더링한다. 아이콘 색상은 CSS `currentColor` 기준으로 화면 상태에 맞춰 바뀐다.

## 개발 원칙

- 웹과 Steam의 게임 규칙은 동일하게 유지한다.
- 플랫폼별 UI와 실행 코드는 각각의 앱에서 관리한다.
- 스테이지 데이터와 테스트 케이스는 이후 `shared/`에서 공통 관리한다.
- Release 0에서는 랜덤 생성, Director, Steam 연동, DB를 구현하지 않는다.
- 기능을 추가하기 전에 직접 플레이 가능한지 확인한다.

## 관련 문서

- [게임 기획서](GAME_DESIGN.md)
- [웹 프로토타입 안내](web/README.md)

