# src/popup/

## 개요

확장 아이콘 클릭 시 표시되는 팝업 UI. 300px 너비의 간결한 패널로, AWS 연결 상태 표시, 빠른 실행 버튼, 사이드패널 열기 버튼을 제공한다.

## 파일 목록

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `main.tsx` | 7 | React 엔트리 포인트 — `#root`에 `PopupApp` 마운트 |
| `PopupApp.tsx` | 100 | 팝업 메인 컴포넌트 — 상태 표시 + 빠른 실행 |

## main.tsx

```typescript
createRoot(document.getElementById('root')!).render(
  <StrictMode><PopupApp /></StrictMode>
)
```

React 18 `createRoot` + StrictMode 사용.

## PopupApp.tsx

### 상태

| 상태 | 타입 | 설명 |
|------|------|------|
| `hasCredentials` | `boolean` | AWS 자격증명 설정 여부 |

### 초기화

```typescript
useEffect(() => {
  chrome.storage.local.get('hchat:config', (r) => {
    const cfg = r['hchat:config']
    setHasCredentials(!!cfg?.aws?.accessKeyId && !!cfg?.aws?.secretAccessKey)
  })
}, [])
```

### 주요 함수

**openPanel()**
```typescript
const openPanel = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id })
    window.close()  // 팝업 자동 닫기
  }
}
```

### UI 구조

```
┌─────────────────────────────────┐
│  [H] H Chat                    │  헤더 (로고, 연결 상태 배지)
│      AWS Bedrock · Claude       │
├─────────────────────────────────┤
│  ● AWS Bedrock    ✓ 연결됨     │  AWS 상태 (주황/회색 점)
├─────────────────────────────────┤
│  빠른 실행                      │
│  ┌──────────┐ ┌──────────┐     │
│  │ 📄 페이지 │ │ 🌐 번역   │     │  2x2 그리드 버튼
│  │    요약   │ │          │     │
│  ├──────────┤ ├──────────┤     │
│  │ ✏️ 글쓰기 │ │ 🤖 그룹   │     │
│  │          │ │   채팅    │     │
│  └──────────┘ └──────────┘     │
├─────────────────────────────────┤
│  [ ■ 사이드패널 열기 →        ] │  메인 CTA (그라디언트 버튼)
└─────────────────────────────────┘
```

### 연결 상태 표시

| 상태 | 배지 색상 | 점 색상 | 텍스트 |
|------|----------|---------|--------|
| 연결됨 (1개 이상) | 초록 | 주황 (`#ff9900`) | "연결됨 ✓" |
| 미설정 (모두) | 빨강 | 회색 | "키 없음" |

v3에서는 최소 1개 프로바이더가 설정되어 있으면 "연결됨"으로 표시.

### 스타일

- **너비**: 300px 고정
- **배경**: `var(--bg1)` (다크 테마)
- **폰트**: IBM Plex Sans KR
- **인라인 스타일**: 컴포넌트 내부에서 직접 정의
- **CSS 변수 참조**: `var(--bg1)`, `var(--text0)`, `var(--border)`, `var(--accent)` 등

### 동작 흐름

```
팝업 열림
→ useEffect: chrome.storage.local.get('hchat:config')
→ hasCredentials 상태 설정
→ UI 렌더링

버튼 클릭 (빠른 실행 또는 메인 CTA)
→ openPanel()
→ chrome.tabs.query({ active: true, currentWindow: true })
→ chrome.sidePanel.open({ tabId })
→ window.close()
```

## 의존성

| 모듈 | 사용 목적 |
|------|----------|
| `../styles/global.css` | CSS 변수 참조 (직접 클래스 사용은 제한적) |
| Chrome API | `chrome.storage.local`, `chrome.tabs.query`, `chrome.sidePanel.open` |
| React 18 | `useState`, `useEffect` |

## 다른 디렉토리와의 관계

- **styles/** — CSS 변수만 참조 (인라인 스타일 주체)
- **sidepanel/** — `openPanel()`으로 사이드패널을 열고 팝업은 닫힘
- **lib/** — 직접 사용하지 않음 (스토리지는 Chrome API 직접 호출)
