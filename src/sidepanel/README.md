# sidepanel

## 개요

Chrome Extension 사이드패널의 메인 앱입니다. 채팅, 설정, 도구 등 모든 기능이 통합된 UI를 제공합니다.

## 파일 구조

### main.tsx (7줄)

React 앱 진입점입니다.

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
```

- React 19의 `createRoot` 사용
- StrictMode로 개발 경고 활성화
- `#root` 요소에 마운트

---

### App.tsx (168줄)

사이드패널 메인 앱 컴포넌트입니다. 탭 기반 네비게이션과 키보드 단축키를 통합합니다.

#### 타입 정의
```typescript
type Tab = 'chat' | 'group' | 'tools' | 'prompts' | 'history' | 'bookmarks' | 'settings'
```

#### 탭 구성
```typescript
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'chat',      icon: '💬', label: '채팅' },
  { id: 'group',     icon: '🤖', label: '그룹' },
  { id: 'tools',     icon: '🛠', label: '도구' },
  { id: 'prompts',   icon: '📚', label: '프롬프트' },
  { id: 'history',   icon: '🕐', label: '기록' },
  { id: 'bookmarks', icon: '🔖', label: '북마크' },
  { id: 'settings',  icon: '⚙️', label: '설정' }
]
```

#### 주요 상태
```typescript
const [tab, setTab] = useState<Tab>('chat')                 // 현재 활성 탭
const [loadConvId, setLoadConvId] = useState<string | undefined>()  // 로드할 대화 ID
const [contextEnabled, setContextEnabled] = useState(true)  // 페이지 컨텍스트 활성화
const [showSearch, setShowSearch] = useState(false)         // 검색 모달 표시
```

#### Ref를 통한 액션 등록
```typescript
const chatNewRef = useRef<() => void>()     // 새 대화 시작
const chatStopRef = useRef<() => void>()    // 생성 중지
const chatInputRef = useRef<() => void>()   // 입력창 포커스
```
- ChatView가 `onRegisterActions`를 통해 함수 등록
- 키보드 단축키에서 호출

#### 훅 사용
```typescript
const { config, loaded } = useConfig()
useShortcuts(shortcutActions)
```

#### 주요 함수

**cycleTab(dir: 1 | -1)**
```typescript
const cycleTab = useCallback((dir: 1 | -1) => {
  setTab((current) => {
    const idx = TAB_ORDER.indexOf(current)
    const next = (idx + dir + TAB_ORDER.length) % TAB_ORDER.length
    return TAB_ORDER[next]
  })
}, [])
```
- Ctrl+] / Ctrl+[ 로 탭 순환
- 순환 배열 인덱스 계산

**shortcutActions**
```typescript
const shortcutActions = useMemo<Partial<Record<ShortcutAction, () => void>>>(() => ({
  'new-chat': () => { setTab('chat'); chatNewRef.current?.() },
  'focus-input': () => { setTab('chat'); chatInputRef.current?.() },
  'stop-generation': () => chatStopRef.current?.(),
  'search-history': () => setShowSearch(true),
  'toggle-context': () => setContextEnabled((v) => !v),
  'next-tab': () => cycleTab(1),
  'prev-tab': () => cycleTab(-1)
}), [cycleTab])
```
- 키보드 단축키와 액션 매핑
- useMemo로 불필요한 재생성 방지

#### UI 구조

**1. 로딩 화면**
```typescript
if (!loaded) {
  return (
    <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner-sm" />
    </div>
  )
}
```
- 설정 로딩 중 스피너 표시

**2. 초기 설정 화면**
```typescript
if (!hasAnyKey && tab !== 'settings') {
  return (
    <div className="app">
      <div className="topbar">...</div>
      <div className="content">
        <div className="chat-empty">
          <h2>H Chat에 오신 것을 환영합니다</h2>
          <p>AWS Bedrock을 통한 Claude AI 어시스턴트</p>
          <button onClick={() => setTab('settings')}>
            ⚙️ AWS 자격증명 설정하기
          </button>
        </div>
      </div>
    </div>
  )
}
```
- AWS 키 없을 때 안내 화면
- 설정 탭으로 이동 버튼

**3. 메인 앱**

**Topbar**
```typescript
<div className="topbar">
  <div className="logo">H</div>
  <div className="tab-bar">
    {TABS.map((t) => (
      <button className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
        <span className="tab-icon">{t.icon}</span>
        <span>{t.label}</span>
      </button>
    ))}
  </div>
  <div className="topbar-actions">
    <button className="icon-btn" title="메시지 검색 (Ctrl+Shift+F)" onClick={() => setShowSearch(true)}>🔍</button>
  </div>
</div>
```
- H 로고
- 7개 탭 버튼
- 검색 버튼

**Content**
```typescript
<div className={`content ${tab === 'chat' || tab === 'group' ? 'flex-col' : ''}`}>
  {tab === 'chat' && <ChatView ... />}
  {tab === 'group' && <GroupChatView ... />}
  {tab === 'tools' && <ToolsView ... />}
  {tab === 'prompts' && <PromptLibraryView ... />}
  {tab === 'history' && <HistoryView ... />}
  {tab === 'bookmarks' && <BookmarksView />}
  {tab === 'settings' && <SettingsView />}
</div>
```
- 조건부 렌더링 (현재 탭만 표시)
- chat/group은 flex-col 레이아웃

**MessageSearchModal**
```typescript
<MessageSearchModal
  open={showSearch}
  onClose={() => setShowSearch(false)}
  onSelect={(convId) => { setLoadConvId(convId); setTab('chat') }}
/>
```
- 전체 대화 검색 모달
- 선택 시 chat 탭으로 이동 및 대화 로드

#### Props 전달

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
- 설정, 대화 로드, 컨텍스트 관리
- 액션 등록 콜백
- 대화 분기 시 새 대화 로드

**HistoryView**
```typescript
<HistoryView
  activeId={loadConvId}
  onSelect={(id) => {
    setLoadConvId(id)
    setTab('chat')
  }}
/>
```
- 대화 선택 시 chat 탭으로 이동 및 로드

**PromptLibraryView**
```typescript
<PromptLibraryView
  onUsePrompt={(content) => {
    setTab('chat')
    // TODO: pass to chat view
  }}
/>
```
- 프롬프트 적용 시 chat 탭 전환
- TODO: 입력창에 프롬프트 주입 (현재 미구현)

#### 키보드 단축키 플로우

```
사용자가 Ctrl+N 누름
→ useShortcuts hook의 handler 실행
→ matchShortcut()로 'new-chat' 매칭
→ shortcutActions['new-chat']() 실행
→ setTab('chat') + chatNewRef.current?.()
→ ChatView에서 startNew() 호출
→ 새 대화 시작
```

## 데이터 플로우

### 대화 로드
```
HistoryView에서 대화 클릭
→ onSelect(id) 호출
→ setLoadConvId(id) + setTab('chat')
→ ChatView의 useEffect 실행
→ loadConv(id) 호출
→ ChatHistory.get(id)
→ 메시지 화면 표시
```

### 대화 분기
```
ChatView에서 분기 버튼 클릭
→ ChatHistory.fork(convId, msgId)
→ 새 대화 ID 반환
→ onForkConv(newId) 호출
→ setLoadConvId(newId) + setTab('chat')
→ 새 대화 로드
```

### 메시지 검색
```
Ctrl+K 또는 🔍 버튼 클릭
→ setShowSearch(true)
→ MessageSearchModal 표시
→ 검색어 입력 (디바운스 300ms)
→ searchMessages() 호출
→ 결과 클릭
→ onSelect(convId) 호출
→ setLoadConvId(convId) + setTab('chat')
→ 해당 대화 로드
```

### 페이지 컨텍스트 토글
```
Ctrl+Shift+P 누름
→ setContextEnabled((v) => !v)
→ ChatView의 contextEnabled prop 변경
→ sendMessage() 호출 시 pageContext 포함 여부 결정
```

## 스타일링

### 레이아웃
```css
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.topbar {
  flex-shrink: 0;
  height: 56px;
}

.content {
  flex: 1;
  overflow-y: auto;
}
```
- 전체 높이 사용
- Topbar 고정
- Content 스크롤 가능

### 탭 버튼
```css
.tab-btn {
  padding: 8px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.12s;
}

.tab-btn.active {
  background: var(--accent-dim);
  color: var(--accent);
}
```
- 활성 탭 하이라이트
- 호버 효과

### 반응형
- 고정 너비 사이드패널 (Chrome의 사이드패널 규격)
- 수직 스크롤만 지원

## 성능 최적화

### 조건부 렌더링
- 현재 탭만 렌더링 (다른 탭은 unmount)
- 메모리 효율적

### useMemo/useCallback
- `shortcutActions`: 불필요한 재생성 방지
- `cycleTab`: 안정적인 참조 유지

### Lazy Loading
- 각 탭 컴포넌트는 필요할 때만 렌더링
- 초기 로딩 속도 향상

## 에러 처리

### 설정 미완료
- `!hasAnyKey`: 초기 설정 화면 표시
- 명확한 안내 및 액션 버튼

### 로딩 상태
- `!loaded`: 스피너 표시
- 설정 로드 완료 전 UI 차단

## 테스트 시나리오

1. **초기 로드**
   - 설정 로드 → 로딩 화면
   - AWS 키 없음 → 안내 화면
   - AWS 키 있음 → 메인 앱

2. **탭 전환**
   - 탭 버튼 클릭 → 해당 뷰 표시
   - Ctrl+] → 다음 탭
   - Ctrl+[ → 이전 탭

3. **대화 로드**
   - 기록 탭에서 대화 선택 → chat 탭으로 이동 및 로드
   - 검색에서 대화 선택 → chat 탭으로 이동 및 로드

4. **키보드 단축키**
   - Ctrl+N → 새 대화
   - / → 입력창 포커스
   - ESC → 생성 중지
   - Ctrl+K → 검색 모달
   - Ctrl+Shift+P → 컨텍스트 토글

## 개선 가능성

1. **탭 상태 보존**: 탭 전환 시 스크롤 위치, 입력 상태 보존
2. **북마크**: 자주 사용하는 탭 북마크
3. **알림**: 새 메시지, 에러 등 토스트 알림
4. **테마**: 라이트/다크 모드 전환
5. **다국어**: i18n 지원

## 의존성

### React
- useState, useCallback, useRef, useMemo, useEffect

### Hooks
- useConfig: 설정 관리
- useShortcuts: 키보드 단축키

### Components
- ChatView, GroupChatView, ToolsView
- PromptLibraryView, HistoryView, BookmarksView, SettingsView
- MessageSearchModal

### 스타일
- ../styles/global.css

## 아키텍처 패턴

### Props Drilling 최소화
- useConfig: 최상위에서 로드, 필요한 컴포넌트에만 전달
- useShortcuts: 액션 맵만 전달, 세부 로직은 각 컴포넌트

### Unidirectional Data Flow
- App (상태) → Component (Props) → User Action → App (상태 업데이트)

### Separation of Concerns
- App: 라우팅 및 전역 상태
- Components: 개별 기능 UI
- Hooks: 비즈니스 로직
- Lib: 데이터 계층

### Event-driven Communication
- 콜백 Props로 자식 → 부모 통신
- Ref로 부모 → 자식 액션 호출 (단축키용)
