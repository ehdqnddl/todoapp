# 테스트 전략 및 루틴

이 프로젝트는 세 계층의 자동 테스트로 검증합니다. 새 기능을 추가하거나 기존 동작을 바꿀 때마다 이 문서의 루틴을 그대로 따릅니다.

## 테스트 계층

| 계층 | 파일 | 검증 대상 | 실행 |
|---|---|---|---|
| 1. 단위 테스트 | `app.test.js` | `app.js`의 순수 함수(`addTodo`, `toggleTodo`, `computeProgress` 등) 하나하나의 입출력 | `npm run test:unit` |
| 2. 시나리오(통합) 테스트 | `app.test.js` 내 `// --- 시나리오 기반 통합 테스트 ---` 구역 | 여러 순수 함수를 실제 사용 흐름대로 이어붙인 결과 (예: 추가→완료→새로고침→진행률 확인) | `npm run test:unit` (단위 테스트와 같은 파일/러너) |
| 3. E2E(브라우저 시뮬레이션) | `e2e/*.spec.js` | 실제 Chromium에서 클릭·타이핑·새로고침까지 포함한 전체 UI 동작 | `npm run test:e2e` |

한 번에 전부 실행: `npm run test:all`

둘 다 **외부 서비스나 네트워크 없이** 로컬에서 완결됩니다. E2E는 Playwright의 `webServer` 설정이 `serve.mjs`(Node 내장 `http` 모듈만 사용하는 정적 서버)를 자동으로 띄우고 끝나면 종료합니다 — 별도로 `run.bat`을 켜둘 필요 없습니다.

## 계층별 사용 기준

- **순수 로직(상태 변경 함수)을 추가/수정했다면** → 반드시 1번(단위 테스트)부터. TDD 원칙대로 실패하는 테스트를 먼저 쓰고, 통과하는 최소 구현을 작성한다.
- **여러 함수가 연쇄적으로 상호작용하는 흐름(예: 삭제→취소, 내보내기→가져오기, 필터링된 상태에서 토글)을 추가/수정했다면** → 2번(시나리오 테스트)에 케이스를 추가한다. "함수 A 다음에 B를 호출했을 때도 여전히 맞는가"를 검증하는 게 목적이므로, 최소 2~3단계 이상 이어지는 흐름을 하나의 테스트로 묶는다.
- **DOM 렌더링, 이벤트 연결, 브라우저 API(localStorage, Service Worker, 파일 다운로드/업로드, 다이얼로그)가 관련된 기능을 추가/수정했다면** → 3번(Playwright E2E)에 케이스를 추가한다. 이 계층만이 실제 클릭/새로고침/서비스 워커 등록을 검증할 수 있다.

새 기능 하나는 보통 세 계층 중 하나만 건드리는 게 아니라 **1번(로직) + 3번(그 로직을 사용하는 UI)** 조합으로 끝나는 경우가 많다. 예를 들어 "카테고리 변경" 기능은 `changeTodoCategory` 단위 테스트(1번) + 드롭다운 조작 E2E(3번)가 함께 필요했다.

## 새 기능을 추가할 때의 루틴 (체크리스트)

1. `app.js`에 새 순수 함수가 필요한가?
   - [ ] `app.test.js`에 실패하는 테스트를 먼저 작성 (RED)
   - [ ] `node --test`로 실패 확인
   - [ ] 최소 구현 작성 (GREEN)
   - [ ] `node --test`로 통과 확인
2. 이 함수가 다른 함수와 이어지는 흐름을 만드는가? (예: 추가 후 필터링, 삭제 후 복원)
   - [ ] `// --- 시나리오 기반 통합 테스트 ---` 구역에 흐름 전체를 검증하는 테스트 추가
3. UI(버튼, 입력, 드롭다운, 체크박스 등)가 추가/변경됐는가?
   - [ ] `e2e/` 아래 적절한 스펙 파일(없으면 새 파일)에 시나리오 추가
   - [ ] `npx playwright test`로 통과 확인
4. `APP_SHELL`에 포함된 파일(`index.html`, `style.css`, `app.js`, `manifest.json`, 아이콘 등) 중 **내용이 하나라도** 바뀌었는가? (새 파일을 목록에 추가한 경우뿐 아니라, 기존 파일 내용만 수정한 경우도 포함)
   - [ ] `CACHE_NAME` 버전을 올린다 (`v3` → `v4` 등) — 캐시가 cache-first 전략이라 버전을 안 올리면 이미 설치된 사용자는 새 내용을 영영 받지 못한다
   - [ ] `app.test.js`의 manifest/service-worker 관련 테스트가 여전히 통과하는지 확인
5. 커밋 전 최종 확인: `npm run test:all` 전체 통과
6. GitHub Pages는 정적 파일만 배포하므로, `e2e/`, `playwright.config.js`, `serve.mjs`, `node_modules/`는 배포에 영향을 주지 않는다 (배포되어도 무해하지만 굳이 필요하지도 않음).

## 파일 구조

```
Todoapp/
├── app.js                 # 순수 로직 + DOM 렌더링(브라우저 전용 가드)
├── app.test.js             # 1) 단위 테스트 + 2) 시나리오 테스트 + manifest/SW 설정 검증
├── playwright.config.js    # E2E 설정 (webServer가 serve.mjs를 자동 기동)
├── serve.mjs                # E2E용 최소 정적 파일 서버 (Node 내장 모듈만 사용)
└── e2e/
    ├── helpers.js           # 공통 헬퍼 (gotoFresh, addTodo, todoItem)
    ├── smoke.spec.js         # 최소 헬스체크
    ├── crud.spec.js          # 추가/편집/삭제+취소/완료토글+정렬
    ├── filter-progress.spec.js  # 카테고리 필터/진행률/탭 카운트/카테고리 변경
    ├── backup.spec.js        # 내보내기/가져오기(성공·실패·취소)
    ├── persistence.spec.js   # 새로고침 후 데이터/필터 유지
    └── pwa.spec.js           # manifest, 서비스 워커 등록, 도움말 링크
```

## 실행 명령 모음

```bash
npm run test:unit   # node --test (단위 + 시나리오)
npm run test:e2e    # playwright test (실브라우저)
npm run test:all    # 위 둘 다 순서대로
```

Playwright 브라우저가 아직 없다면 최초 1회: `npx playwright install chromium`
