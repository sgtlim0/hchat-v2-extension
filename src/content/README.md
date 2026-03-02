# src/content/

## 개요

모든 웹페이지에 주입되는 콘텐츠 스크립트. 두 가지 핵심 역할을 수행한다:

1. **페이지 컨텍스트 추적** — 현재 페이지의 URL, 제목, 본문, 선택 텍스트를 추출하여 스토리지에 저장
2. **플로팅 AI 툴바** — 텍스트 선택 시 나타나는 AI 도구 툴바 (설명/번역/요약/다듬기/교정/하이라이트)

## 파일 목록

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `index.ts` | 136 | 엔트리 포인트 — 페이지 컨텍스트 추적, 하이라이트 복원 |
| `toolbar.ts` | 439 | 플로팅 AI 툴바 — 순수 DOM 조작 (React 미사용) |

## index.ts — 페이지 컨텍스트 추적

### 주요 함수

| 함수 | 설명 |
|------|------|
| `extractMainContent()` | 시맨틱 요소(`article`, `main`, `[role="main"]`, `#content`, `.content`)에서 본문 추출. 가장 많은 텍스트를 포함한 요소 선택. 최대 8,000자 |
| `detectPageType(url)` | URL 패턴으로 페이지 유형 감지 (`code`/`video`/`social`/`docs`/`unknown`) |
| `updatePageContext()` | 페이지 정보를 `hchat:page-context` 스토리지에 저장 |
| `restoreHighlights()` | 백그라운드에서 현재 URL의 하이라이트를 가져와 `<mark>` 태그로 DOM에 복원 |

### 이벤트 타이밍

| 이벤트 | 딜레이 | 설명 |
|--------|--------|------|
| 페이지 로드 | 1.5초 | 초기 컨텍스트 캡처 (DOM 안정화 대기) |
| SPA 네비게이션 | 0.8초 | `MutationObserver`로 URL 변경 감지 |
| 텍스트 선택 | 0.5초 | `mouseup` 이벤트 디바운스, 10자 이상만 저장 (최대 1,000자) |
| 하이라이트 복원 | 2.0초 | XPath 기반 DOM 위치 찾기, `hchat-highlight-${color}` 클래스 |
| `UPDATE_PAGE_CONTEXT` | 즉시 | 탭 활성화 시 백그라운드에서 전송 |

### 하이라이트 복원 과정

```
GET_HIGHLIGHTS 메시지 → 현재 URL 하이라이트 조회
→ XPath로 텍스트 노드 찾기 (document.evaluate)
→ textOffset으로 Range 설정
→ <mark class="hchat-highlight hchat-highlight-yellow"> 태그 삽입
```

## toolbar.ts — 플로팅 AI 툴바

### 아키텍처

React를 사용하지 않고 순수 DOM API로 구현된 독립적인 UI 컴포넌트이다. 웹페이지의 기존 스타일에 영향을 주지 않기 위해 최고 z-index(`2147483647`)를 사용한다. `<style id="hchat-styles">`로 인라인 CSS를 주입한다.

### 액션 정의

| 액션 ID | 아이콘 | 라벨 | 프롬프트 |
|---------|--------|------|----------|
| `explain` | 💡 | 설명 | "다음을 쉽게 설명해줘" |
| `translate` | 🌐 | 번역 | "다음을 한국어로 번역해줘" |
| `summarize` | 📄 | 요약 | "다음을 3줄로 요약해줘" |
| `rewrite` | ✏️ | 다듬기 | "다음 문장을 더 명확하게 다듬어줘" |
| `formal` | 🎩 | 격식체 | "다음을 격식 있는 문체로 바꿔줘" |
| `grammar` | ✅ | 교정 | "다음의 문법과 맞춤법을 교정해줘" |
| `highlight` | 🖍️ | 하이라이트 | (저장만, API 호출 없음) |

### 주요 함수

| 함수 | 설명 |
|------|------|
| `getStyles()` | 인라인 CSS 문자열 반환 (다크 테마, 애니메이션) |
| `injectStyles()` | `<style>` 태그 주입 (중복 방지) |
| `createToolbar()` | H 로고 + 구분선 + 액션 버튼 DOM 생성 |
| `createResultPanel(title)` | 헤더/본문/푸터 구조의 결과 패널 생성 |
| `positionElement(el, x, y)` | 뷰포트 경계 고려한 위치 조정 |
| `runAction(actionId, text, x, y)` | 백그라운드 포트 연결 → Bedrock 스트리밍 → 결과 패널 렌더링 |
| `saveHighlight(text)` | XPath + textOffset 계산 → `SAVE_HIGHLIGHT` 전송 → `<mark>` 표시 |
| `getXPathForNode(node)` | DOM 노드의 XPath 경로 생성 |

### 스트리밍 방식

콘텐츠 스크립트에서 직접 AWS API를 호출할 수 없으므로, 포트 통신으로 백그라운드에 위임한다:

```
toolbar 버튼 클릭
→ chrome.runtime.connect({ name: 'toolbar-stream' })
→ port.postMessage({ type: 'TOOLBAR_STREAM', aws, model, prompt })
→ background/index.ts에서 Bedrock API 호출
→ port.onMessage로 { type: 'chunk', text } 수신
→ 결과 패널에 실시간 렌더링
→ { type: 'done' } 수신 시 커서 제거
```

### 이벤트 리스너

| 이벤트 | 동작 |
|--------|------|
| `mousemove` | 마우스 위치 추적 (툴바 위치 계산용, passive) |
| `mouseup` | 텍스트 선택 감지 → `enableContentScript` 확인 → 툴바 표시 |
| `mousedown` | 툴바/결과 패널 외부 클릭 시 숨김 (200ms 딜레이) |
| `keydown` | ESC 키로 닫기 |
| `SELECTION_ACTION` 메시지 | 백그라운드 컨텍스트 메뉴 클릭 처리 |

### 스타일

- **툴바**: `#0e1318` 배경, `rgba(255,255,255,0.1)` 테두리, `0 8px 32px` 그림자
- **결과 패널**: 340px 너비, 최대 400px 높이, 스크롤
- **호버**: `rgba(52,211,153,0.1)` 배경 + 에메랄드 텍스트
- **커서 애니메이션**: 0.8s 깜빡임

## 의존성

- **외부 모듈 없음** — 순수 TypeScript + DOM API + Chrome Extension API
- `index.ts` → `toolbar.ts` (사이드 이펙트 임포트)

## 스토리지 키

| 키 | 용도 |
|----|------|
| `hchat:page-context` | 현재 페이지 컨텍스트 (`url`, `title`, `text`, `selection`, `meta`, `ts`) |
| `hchat:config` | 설정 조회 (`enableContentScript` 여부 확인) |

## 주의사항

1. **Performance**: `MutationObserver`는 전체 DOM을 감시하므로 콜백을 최소화함
2. **XPath 복원 실패**: DOM 구조 변경 시 하이라이트 복원 불가 (무시 처리)
3. **CSP 제한**: Content Security Policy가 엄격한 사이트에서는 스타일 주입 불가
4. **iframe 불가**: Same-origin policy로 iframe 내부 접근 불가
