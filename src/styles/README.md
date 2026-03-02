# src/styles/

## 개요

H Chat v2의 전역 CSS 디자인 시스템. 단일 파일(`global.css`)에 CSS 변수 기반 다크 테마, 20개 이상의 컴포넌트 스타일, 애니메이션, 타이포그래피를 정의한다. 외부 CSS 프레임워크 없이 순수 CSS로 구현.

## 파일 목록

| 파일 | 줄 수 | 크기 | 설명 |
|------|-------|------|------|
| `global.css` | 1,986 | ~33KB | 전역 디자인 시스템 (유일한 CSS 파일) |

## 섹션 구조

| 줄 범위 | 섹션 | 설명 |
|---------|------|------|
| 1-63 | **Design System** | CSS 변수, 리셋, 기본 스타일, 스크롤바 |
| 64-146 | **Layout** | `.app`, `.topbar`, `.tab-bar`, `.content`, `.logo` |
| 147-198 | **Buttons** | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.icon-btn` |
| 199-222 | **Form** | `.input`, `.textarea`, `.select`, `.field-input` |
| 223-243 | **Badges & Chips** | `.badge`, `.badge-green`, `.badge-red`, `.tag` |
| 244-594 | **Chat** | 메시지 버블, 마크다운 렌더링, 코드 블록, 입력 영역, 제안 카드, 에이전트 스텝 |
| 595-618 | **Sidebar / Panel Common** | 패널 공통 스타일 |
| 619-641 | **History** | 대화 기록 목록, 항목, 태그 |
| 642-711 | **Group Chat** | 그룹 채팅 모델 선택, 응답 그리드 |
| 712-807 | **Tools** | 도구 카드, 결과 영역, 입력 폼 |
| 808-887 | **Settings** | 설정 섹션, 토글 스위치, AWS 상태 |
| 888-912 | **Prompt Library** | 프롬프트 카드, 카테고리 필터 |
| 913-989 | **Misc** | 스피너, 오버레이, 토스트, `fadeUp` 애니메이션 |
| 990-1029 | **Export Menu** | 내보내기 드롭다운 메뉴 |
| 1030-1057 | **Keyboard Shortcuts UI** | 단축키 표시 (`<kbd>` 스타일) |
| 1058-1107 | **Web Search** | 검색 소스 칩, 검색 중 인디케이터 |
| 1108-1740 | **Bookmarks / Highlights** | 북마크 뷰, 하이라이트 색상, 메모 편집 |
| 1741-1875 | **Message Search Modal** | 검색 모달 오버레이, 결과 하이라이팅 |
| 1876-1920 | **Summary Panel** | 대화 요약 패널 |
| 1921-1986 | **Pinned Messages Panel** | 고정 메시지 사이드 패널 |

## 디자인 토큰 (CSS 변수)

### 색상 체계 (Dark Obsidian 테마)

```css
:root {
  /* 배경 — 어두운 것부터 밝은 것까지 */
  --bg0: #080b0e;        /* 페이지 배경 */
  --bg1: #0e1318;        /* 사이드바/패널 */
  --bg2: #141b24;        /* 카드/입력 */
  --bg3: #1a2233;        /* 호버 */
  --bg4: #212d40;        /* 활성 */
  --bg5: #2a3a52;        /* 스크롤바 */

  /* 테두리 */
  --border:  rgba(255,255,255,0.06);
  --border2: rgba(255,255,255,0.1);
  --border3: rgba(255,255,255,0.16);

  /* 텍스트 */
  --text0: #eef1f5;      /* 주요 텍스트 */
  --text1: #adb8c8;      /* 보조 텍스트 */
  --text2: #6b7c93;      /* 3차 텍스트 */
  --text3: #3d4f65;      /* 비활성 */

  /* 브랜드 / 액센트 (Emerald) */
  --accent:     #34d399;
  --accent2:    #10b981;
  --accent-dim: rgba(52,211,153,0.1);
  --accent-glow: rgba(52,211,153,0.25);

  /* 시맨틱 색상 */
  --purple: #a78bfa;
  --blue:   #60a5fa;
  --amber:  #fbbf24;
  --red:    #f87171;
  --red-dim: rgba(248,113,113,0.1);
}
```

### 타이포그래피

```css
--mono: 'IBM Plex Mono', monospace;
--sans: 'IBM Plex Sans KR', 'Noto Sans KR', sans-serif;
```

| 용도 | 크기 | 가중치 |
|------|------|--------|
| 본문 | 13px, line-height 1.6 | 400 |
| 소형 (버튼, 레이블) | 12px | 500 |
| 초소형 (힌트, 메타) | 10-11px | 300-400 |
| 코드 | 12.5px | 400 |
| 제목 (h1-h3) | 16-20px | 600-700 |

### 공간 / 모서리 / 그림자

```css
--radius:    10px;
--radius-sm: 6px;
--radius-lg: 14px;
--shadow:    0 4px 24px rgba(0,0,0,0.4);
--shadow-sm: 0 2px 8px rgba(0,0,0,0.3);
```

## 주요 컴포넌트 스타일

### 메시지 버블

| 클래스 | 설명 |
|--------|------|
| `.msg` | 메시지 컨테이너 (fadeUp 애니메이션) |
| `.msg-user` | 사용자 메시지 정렬 |
| `.msg-user .msg-text` | 에메랄드 그라디언트 배경 (`#183b2e` → `#0e2a1f`) |
| `.msg-ai` | AI 메시지 정렬 |
| `.msg-ai .msg-text` | 투명 배경, 마크다운 렌더링 |
| `.msg-actions` | 복사/편집/TTS/핀 버튼 (호버 시 표시) |

### 코드 블록

```css
.msg-text pre {
  background: #080b0e;
  border-radius: 8px;
  overflow-x: auto;
}
.code-header {
  background: rgba(255,255,255,0.03);
  /* 언어 라벨 + 복사 버튼 */
}
```

### 에이전트 스텝

```css
.agent-step { border-left: 2px solid var(--accent-dim); }
.agent-step-thinking { border-color: var(--purple); }
.agent-step-tool_call { border-color: var(--blue); }
.agent-step-tool_result { border-color: var(--accent); }
```

### 토글 스위치

```css
.toggle { width: 36px; height: 20px; border-radius: 10px; }
.toggle-on { background: var(--accent); }
.toggle-on::after { transform: translateX(16px); }
```

## 애니메이션

| 이름 | 속성 | 용도 |
|------|------|------|
| `fadeUp` | `opacity 0→1`, `translateY 8px→0` | 메시지 등장 (0.2s) |
| `blink` | `opacity 1→0→1` | 스트리밍 커서 깜빡임 (0.8s) |
| `spin` | `rotate 0→360` | 로딩 스피너 (0.8s) |
| `pulse` | `opacity 1→0.4→1` | 검색 중 인디케이터 (1.2s) |

## 반응형

사이드패널은 Chrome이 관리하는 고정 너비이므로 미디어 쿼리를 사용하지 않는다.

- 메시지 버블: `max-width: 85%`
- 코드 블록: `overflow-x: auto` (가로 스크롤)
- 테이블: `overflow-x: auto` 래퍼

## 글꼴 로드

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;1,400&family=IBM+Plex+Sans+KR:wght@300;400;500;600;700&display=swap');
```

- **IBM Plex Sans KR**: 본문 (300-700 가중치)
- **IBM Plex Mono**: 코드, 모노스페이스 (300-600 가중치, 이탤릭 포함)

## 의존성

| 대상 | 관계 |
|------|------|
| Google Fonts CDN | 런타임 글꼴 로드 |
| `popup/main.tsx` | 임포트 |
| `sidepanel/main.tsx` | 임포트 |
| 모든 `components/*.tsx` | CSS 클래스 참조 |

## 다른 디렉토리와의 관계

- **components/** — 모든 컴포넌트가 이 CSS 클래스를 사용
- **popup/** — CSS 변수만 참조 (인라인 스타일 주체)
- **content/toolbar.ts** — 별도 인라인 CSS 사용 (이 파일 미참조, 웹페이지 격리)
