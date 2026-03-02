# popup

## 개요

확장 아이콘 클릭 시 표시되는 팝업 UI입니다. 간단한 상태 표시와 사이드패널 실행 버튼을 제공합니다.

## 파일 구조

### main.tsx (7줄)

React 앱 진입점입니다.

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PopupApp } from './PopupApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode><PopupApp /></StrictMode>
)
```

- React 19의 `createRoot` 사용
- StrictMode로 감싸서 개발 시 경고 표시
- `#root` 요소에 마운트

---

### PopupApp.tsx (100줄)

팝업 UI 메인 컴포넌트입니다.

#### 상태
```typescript
const [hasCredentials, setHasCredentials] = useState(false)
```
- AWS 자격증명 유무 확인
- 초기화 시 `chrome.storage.local`에서 로드

#### 주요 함수

**useEffect 초기화**
```typescript
useEffect(() => {
  chrome.storage.local.get('hchat:config', (r) => {
    const cfg = r['hchat:config']
    setHasCredentials(!!cfg?.aws?.accessKeyId && !!cfg?.aws?.secretAccessKey)
  })
}, [])
```
- 컴포넌트 마운트 시 설정 조회
- accessKeyId와 secretAccessKey 존재 여부 확인

**openPanel()**
```typescript
const openPanel = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id })
    window.close()  // 팝업 닫기
  }
}
```
- 현재 활성 탭에서 사이드패널 열기
- 성공 후 팝업 자동 닫힘

#### UI 구조

**1. 헤더 (Header)**
- H 로고 (그라디언트 배경)
- 앱 이름 및 설명 (`AWS Bedrock · Claude`)
- 연결 상태 배지:
  - 연결됨 (초록): AWS 키 있음
  - 미설정 (빨강): AWS 키 없음

**2. AWS 상태 (Status)**
- 주황색 점 (AWS 색상): 연결됨
- 회색 점: 미연결
- "AWS Bedrock" 레이블
- 상태 텍스트 (연결됨 / 키 없음)

**3. 빠른 실행 (Quick Actions)**
- 2x2 그리드 레이아웃
- 액션 버튼:
  - 📄 페이지 요약
  - 🌐 번역
  - ✏️ 글쓰기
  - 🤖 그룹 채팅
- 모든 버튼은 `openPanel()` 호출
- 호버 시 테두리 색상 변경

**4. 메인 버튼 (Open Button)**
- 그라디언트 배경 (초록 계열)
- "사이드패널 열기 →" 텍스트
- 전체 너비
- 클릭 시 `openPanel()` 호출

#### 스타일
```typescript
width: 300px
background: var(--bg1)
fontFamily: 'IBM Plex Sans KR, sans-serif'
```
- 다크 테마 기본
- 고정 너비 300px
- 반응형 불필요 (고정 크기 팝업)

#### 상호작용 패턴

**초기화 플로우**
```
팝업 열림
→ useEffect 실행
→ chrome.storage.local.get('hchat:config')
→ hasCredentials 상태 설정
→ UI 렌더링 (연결 상태 표시)
```

**사이드패널 열기 플로우**
```
버튼 클릭
→ openPanel()
→ chrome.tabs.query (현재 활성 탭)
→ chrome.sidePanel.open({ tabId })
→ window.close() (팝업 닫기)
```

## 의존성

### Chrome APIs
- `chrome.storage.local.get()`: 설정 조회
- `chrome.tabs.query()`: 현재 탭 조회
- `chrome.sidePanel.open()`: 사이드패널 열기

### React
- `useState`: 상태 관리
- `useEffect`: 초기화

### 스타일
- `../styles/global.css`: 전역 CSS 변수 사용

## 디자인 시스템

### 색상
- **Primary**: `#34d399` (초록)
- **Background**: `var(--bg1)` (다크)
- **AWS**: `#ff9900` (주황)
- **Text**: `var(--text0)`, `var(--text3)`
- **Border**: `var(--border)`, `var(--border2)`

### 타이포그래피
- **Body**: IBM Plex Sans KR, sans-serif
- **Mono**: IBM Plex Mono, monospace
- **크기**: 10px (작은 텍스트), 12px (일반), 14px (제목)

### 간격
- **Padding**: 10-16px (섹션별)
- **Gap**: 6-12px (요소 간)

### 아이콘
- 이모지 사용 (📄, 🌐, ✏️, 🤖)
- 크기: 기본 1em

## 성능

### 최적화
- 최소한의 상태 (hasCredentials만)
- 무거운 로직 없음
- 빠른 초기 렌더링

### 메모리
- 컴포넌트 간단 (100줄)
- 메모리 누수 없음 (cleanup 불필요)

## 테스트 시나리오

1. **초기 로드**
   - AWS 키 없음: 미설정 배지 + 회색 점
   - AWS 키 있음: 연결됨 배지 + 주황 점

2. **사이드패널 열기**
   - 버튼 클릭 → 사이드패널 열림 → 팝업 닫힘
   - 빠른 실행 버튼 → 동일 동작

3. **스타일**
   - 다크 테마 적용
   - 호버 효과 동작

## 개선 가능성

1. **통계 표시**: 오늘의 요청 수, 비용 등
2. **최근 대화**: 빠른 접근 링크
3. **단축키 안내**: 키보드 단축키 힌트
4. **설정 바로가기**: 사이드패널 없이 설정 열기

## 주의사항

1. **Chrome API 비동기**: `chrome.sidePanel.open()`은 비동기 호출
2. **탭 조회**: `chrome.tabs.query()`는 active tab이 없을 수 있음 (예: 새 탭)
3. **Storage 권한**: manifest에 storage 권한 필요
4. **사이드패널 권한**: manifest에 sidePanel 권한 필요
