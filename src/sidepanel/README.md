# src/sidepanel/

## 개요

확장의 메인 UI. Chrome 사이드패널에 렌더링되는 탭 기반 SPA로, 채팅/그룹채팅/토론/도구/프롬프트/기록/북마크/설정 8개 탭으로 구성된다. 모든 핵심 기능은 이 사이드패널을 통해 제공된다.

## 파일 목록

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `main.tsx` | 7 | React 엔트리 포인트 — `#root`에 `App` 마운트 |
| `App.tsx` | 168 | 메인 앱 쉘 — 탭 네비게이션, 키보드 단축키, 검색 모달 통합 |

## main.tsx

```typescript
createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
```

React 18 `createRoot` + StrictMode 사용.

## App.tsx

### 탭 정의 [v3 업데이트]

```typescript
type Tab = 'chat' | 'group' | 'debate' | 'tools' | 'prompts' | 'history' | 'bookmarks' | 'settings'
```

| 탭 ID | 아이콘 | 라벨 | 렌더링 컴포넌트 |
|--------|--------|------|----------------|
| `chat` | 💬 | 채팅 | `ChatView` |
| `group` | 🤖 | 그룹 | `GroupChatView` |
| `debate` | 🎭 | 토론 | `DebateView` [v3 신규] |
| `tools` | 🛠 | 도구 | `ToolsView` |
| `prompts` | 📚 | 프롬프트 | `PromptLibraryView` |
| `history` | 🕐 | 기록 | `HistoryView` |
| `bookmarks` | 🔖 | 북마크 | `BookmarksView` |
| `settings` | ⚙️ | 설정 | `SettingsView` |

### 주요 상태

| 상태 | 타입 | 설명 |
|------|------|------|
| `tab` | `Tab` | 현재 활성 탭 (기본: `'chat'`) |
| `loadConvId` | `string \| undefined` | 외부에서 로드할 대화 ID |
| `contextEnabled` | `boolean` | 페이지 컨텍스트 활성화 (기본: `true`) |
| `showSearch` | `boolean` | 검색 모달 표시 여부 |

### Ref를 통한 액션 등록

```typescript
const chatNewRef = useRef<() => void>()    // 새 대화 시작
const chatStopRef = useRef<() => void>()   // 응답 생성 중지
const chatInputRef = useRef<() => void>()  // 입력창 포커스
```

ChatView가 `onRegisterActions` 콜백을 통해 이 ref에 함수를 등록한다. 키보드 단축키가 이 ref를 호출하여 ChatView를 제어한다.

### 키보드 단축키

```typescript
const shortcutActions = useMemo(() => ({
  'new-chat': () => { setTab('chat'); chatNewRef.current?.() },
  'focus-input': () => { setTab('chat'); chatInputRef.current?.() },
  'stop-generation': () => chatStopRef.current?.(),
  'search-history': () => setShowSearch(true),
  'toggle-context': () => setContextEnabled((v) => !v),
  'next-tab': () => cycleTab(1),
  'prev-tab': () => cycleTab(-1),
}), [cycleTab])

useShortcuts(shortcutActions)
```

| 액션 | 기본 키 | 동작 |
|------|---------|------|
| `new-chat` | `Ctrl+N` | 채팅 탭으로 이동 + 새 대화 시작 |
| `focus-input` | `/` | 채팅 탭으로 이동 + 입력창 포커스 |
| `stop-generation` | `Escape` | 응답 생성 중지 |
| `search-history` | `Ctrl+K` | 검색 모달 열기 |
| `toggle-context` | `Ctrl+Shift+P` | 페이지 컨텍스트 토글 |
| `next-tab` | `Ctrl+]` | 다음 탭 (순환) |
| `prev-tab` | `Ctrl+[` | 이전 탭 (순환) |

### 화면 분기

```
설정 로딩 중 (!loaded)
  → 스피너 표시

모든 프로바이더 키 미설정 (!hasAnyKey && tab !== 'settings') [v3 업데이트]
  → 환영 화면 + "AI 프로바이더 설정하기" 버튼

정상 상태
  → Topbar (로고 + 탭바 + 검색 버튼)
  → Content (활성 탭 컴포넌트)
  → MessageSearchModal (오버레이)
```

### UI 구조 [v3 업데이트]

```
┌─────────────────────────────────────┐
│ [H]  💬 🤖 🎭 🛠 📚 🕐 🔖 ⚙️  [🔍] │  Topbar (8탭)
├─────────────────────────────────────┤
│                                     │
│   (현재 활성 탭 컴포넌트)            │  Content
│                                     │
└─────────────────────────────────────┘
```

### Props 전달

**ChatView**
```typescript
<ChatView
  config={config}
  loadConvId={loadConvId}
  onNewConv={() => setLoadConvId(undefined)}
  contextEnabled={contextEnabled}
  onToggleContext={() => setContextEnabled((v) => !v)}
  onRegisterActions={(actions) => {
    chatNewRef.current = actions.startNew
    chatStopRef.current = actions.stop
    chatInputRef.current = actions.focusInput
  }}
  onForkConv={(id) => { setLoadConvId(id); setTab('chat') }}
/>
```

**HistoryView**
```typescript
<HistoryView
  activeId={loadConvId}
  onSelect={(id) => { setLoadConvId(id); setTab('chat') }}
/>
```

**PromptLibraryView**
```typescript
<PromptLibraryView
  onUsePrompt={(content) => { setTab('chat') }}
/>
```

**MessageSearchModal**
```typescript
<MessageSearchModal
  open={showSearch}
  onClose={() => setShowSearch(false)}
  onSelect={(convId) => { setLoadConvId(convId); setTab('chat') }}
/>
```

## 데이터 흐름

### 대화 로드
```
HistoryView에서 대화 클릭
→ onSelect(id) → setLoadConvId(id) + setTab('chat')
→ ChatView의 useEffect: loadConv(id)
→ ChatHistory.get(id) → 메시지 표시
```

### 대화 분기
```
ChatView에서 분기 버튼 클릭
→ ChatHistory.fork(convId, msgId) → 새 대화 ID 반환
→ onForkConv(newId) → setLoadConvId(newId) + setTab('chat')
→ 새 대화 로드
```

### 메시지 검색
```
Ctrl+K 또는 🔍 클릭
→ setShowSearch(true) → MessageSearchModal 표시
→ 검색어 입력 (300ms 디바운스) → searchMessages()
→ 결과 클릭 → onSelect(convId) → setLoadConvId(convId) + setTab('chat')
```

### 키보드 단축키
```
사용자가 Ctrl+N 누름
→ useShortcuts 훅의 keydown 핸들러
→ matchShortcut() → 'new-chat' 매칭
→ shortcutActions['new-chat']() 실행
→ setTab('chat') + chatNewRef.current?.()
→ ChatView에서 startNew() 호출
```

## 아키텍처 패턴

### 조건부 렌더링
현재 활성 탭만 렌더링하고, 나머지 탭은 unmount한다. 메모리 효율적이지만 탭 전환 시 상태가 초기화된다.

### Ref 기반 명령형 통신
키보드 단축키 → App → ref → ChatView 구조로, Props 변경 없이 자식 컴포넌트의 메서드를 직접 호출한다.

### 단방향 데이터 흐름
```
App (전역 상태: tab, loadConvId, contextEnabled, showSearch)
  ↓ Props
Components (개별 상태: messages, input, etc.)
  ↓ 콜백 Props
App (상태 업데이트)
```

## 의존성

| 모듈 | 사용 목적 |
|------|----------|
| `../hooks/useConfig` | 설정 로드 (`config`, `loaded`, `hasAwsKey()`) |
| `../hooks/useShortcuts` | 키보드 단축키 바인딩 |
| `../components/*` | 11개 UI 컴포넌트 |
| `../lib/shortcuts` | `ShortcutAction` 타입 |
| `../styles/global.css` | CSS 디자인 시스템 |
