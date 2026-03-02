# src/background/

## 개요

Chrome Extension MV3 서비스 워커. 확장의 백그라운드 로직을 담당하며, 컨텍스트 메뉴 등록, 사이드패널 제어, 하이라이트 저장/조회, 탭 컨텍스트 갱신, 플로팅 툴바 스트리밍, 키보드 커맨드를 처리한다.

## 파일 목록

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `index.ts` | 236 | 서비스 워커 엔트리 포인트 — 모든 백그라운드 로직 통합 |

## 주요 기능

### 1. 컨텍스트 메뉴 (chrome.contextMenus)

`onInstalled` 시 6개 메뉴 항목을 등록한다:

| 메뉴 ID | 라벨 | 컨텍스트 | 설명 |
|---------|------|----------|------|
| `hchat-explain` | 설명 | selection | 선택 텍스트 설명 |
| `hchat-translate` | 번역 | selection | 한국어 번역 |
| `hchat-summarize` | 요약 | selection | 요약 |
| `hchat-rewrite` | 다듬기 | selection | 문장 다듬기 |
| `hchat-separator` | — | selection | 구분선 |
| `hchat-sidepanel` | H Chat 열기 | all | 사이드패널 열기 |

메뉴 클릭 시 `SELECTION_ACTION` 메시지를 콘텐츠 스크립트로 전송하여 플로팅 툴바에서 해당 액션을 실행한다.

### 2. 아이콘 클릭 → 사이드패널

```typescript
chrome.action.onClicked.addListener(async (tab) => {
  chrome.sidePanel.open({ tabId: tab.id })
})
```

### 3. 메시지 핸들러 (`chrome.runtime.onMessage`)

| 메시지 타입 | 처리 내용 |
|------------|----------|
| `OPEN_SIDEPANEL` | 활성 탭에서 사이드패널 열기 |
| `CONFIG_UPDATED` | 설정을 `chrome.storage.local`에 저장 |
| `SAVE_HIGHLIGHT` | 하이라이트 데이터를 스토리지에 저장 (UUID 생성, 타임스탬프 부여) |
| `GET_HIGHLIGHTS` | URL별 하이라이트 필터링 후 반환 |

### 4. 하이라이트 관리

```typescript
async function handleSaveHighlight(data: {
  text: string; url: string; title: string;
  xpath: string; textOffset: number; color: string; tags: string[]
}): Promise<Highlight>
```

- XPath와 텍스트 오프셋으로 정확한 위치 저장
- UUID 생성 및 `createdAt`/`updatedAt` 타임스탬프 부여
- `hchat:highlights` 배열에 추가

### 5. 탭 활성화 → 페이지 컨텍스트 갱신

`chrome.tabs.onActivated` 이벤트에서 콘텐츠 스크립트에 `UPDATE_PAGE_CONTEXT` 메시지를 전송한다. 콘텐츠 스크립트가 로드되지 않은 탭(예: `chrome://` 페이지)은 에러를 무시한다.

### 6. 툴바 스트리밍 (Bedrock)

```typescript
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'toolbar-stream') return
  // ...
})
```

AWS Bedrock `invoke-with-response-stream` API를 호출하고, AWS Event Stream 바이너리 프로토콜을 직접 파싱한다:

- Binary event stream format: `[4B totalLen][4B headersLen][4B preludeCRC][headers...][payload...][4B msgCRC]`
- Base64 디코딩 후 JSON 파싱
- `content_block_delta` 이벤트에서 텍스트 추출

포트 메시지 프로토콜:
- `{ type: 'chunk', text }` — 텍스트 청크
- `{ type: 'done' }` — 스트리밍 완료
- `{ type: 'error', message }` — 오류 발생

### 7. 키보드 커맨드

`chrome.commands.onCommand`에서 `quick-summarize` 커맨드를 처리. `hchat:quick-action` 스토리지에 액션과 타임스탬프를 저장한 후 사이드패널을 연다.

## 데이터 흐름

### 하이라이트 저장
```
사용자 텍스트 선택 → content/toolbar.ts → SAVE_HIGHLIGHT 메시지
→ handleSaveHighlight() → chrome.storage.local 저장
→ {id, text, url, xpath, textOffset, color, tags, createdAt, updatedAt}
```

### Bedrock 스트리밍
```
toolbar.ts → chrome.runtime.connect('toolbar-stream')
→ TOOLBAR_STREAM 메시지 (aws, model, prompt)
→ signRequest() → Bedrock API 호출
→ Event Stream 파싱 → chunk 메시지 전송
→ toolbar.ts에서 실시간 렌더링
```

### 페이지 컨텍스트 업데이트
```
탭 활성화 → onActivated
→ UPDATE_PAGE_CONTEXT 메시지
→ content/index.ts → extractMainContent()
→ chrome.storage.local에 컨텍스트 저장
```

## 의존성

| 모듈 | 사용 목적 |
|------|----------|
| `../lib/aws-sigv4` | AWS Signature V4 서명 (`signRequest`) |

## 스토리지 키

| 키 | 용도 |
|----|------|
| `hchat:config` | 확장 설정 (AWS 자격증명 포함) |
| `hchat:highlights` | 하이라이트 배열 |
| `hchat:quick-action` | 빠른 실행 액션 (일시적) |
