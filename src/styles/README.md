# src/styles/ — 디자인 시스템

## 개요

H Chat v2의 전역 CSS 디자인 시스템. CSS 변수 기반 Light/Dark 테마, 컴포넌트 스타일, 애니메이션, 타이포그래피를 정의한다. 약 33KB, 1,200줄 이상의 포괄적인 스타일시트.

## 파일 목록

| 파일 | 크기 | 설명 |
|------|-----:|------|
| `global.css` | ~33KB | 전역 디자인 시스템 (유일한 CSS 파일) |

## 디자인 토큰 (CSS 변수)

### 색상 체계

| 토큰 | Light | Dark | 용도 |
|------|-------|------|------|
| `--bg0` | `#FFFFFF` | `#0D1117` | 페이지 배경 |
| `--bg1` | `#F6F8FA` | `#161B22` | 사이드바/패널 배경 |
| `--bg2` | `#F0F2F5` | `#1C2128` | 카드/입력 배경 |
| `--bg3` | `#E8ECF0` | `#2D333B` | 호버 상태 |
| `--text0` | `#1F2328` | `#E6EDF3` | 주요 텍스트 |
| `--text1` | `#424A53` | `#C9D1D9` | 보조 텍스트 |
| `--text2` | `#636C76` | `#8B949E` | 3차 텍스트 |
| `--text3` | `#8C959F` | `#6E7681` | 비활성 텍스트 |
| `--accent` | `#34D399` | `#34D399` | 브랜드 액센트 (에메랄드) |
| `--border` | `#D0D7DE` | `#30363D` | 기본 테두리 |
| `--danger` | `#EF4444` | `#F87171` | 위험/삭제 |
| `--success` | `#22C55E` | `#34D399` | 성공 |

### 타이포그래피

```css
--font-sans: 'IBM Plex Sans KR', -apple-system, sans-serif;
--font-mono: 'IBM Plex Mono', 'JetBrains Mono', monospace;
```

- **본문**: 13px, line-height 1.6
- **소형**: 12px (버튼, 레이블)
- **초소형**: 10-11px (힌트, 메타데이터)
- **코드**: IBM Plex Mono, 12.5px

## 주요 컴포넌트 스타일

### 레이아웃

| 클래스 | 설명 |
|--------|------|
| `.app` | 전체 앱 컨테이너 (flex column, 100vh) |
| `.topbar` | 상단 탭 바 (고정) |
| `.tab-bar` / `.tab-btn` | 탭 네비게이션 |
| `.content` | 메인 컨텐츠 영역 (flex: 1, 스크롤) |

### 채팅

| 클래스 | 설명 |
|--------|------|
| `.chat-container` | 채팅 뷰 래퍼 |
| `.chat-messages` | 메시지 목록 (스크롤) |
| `.msg` / `.msg-user` / `.msg-ai` | 메시지 버블 |
| `.msg-user .msg-text` | 사용자 메시지 (에메랄드 배경) |
| `.msg-ai .msg-text` | AI 메시지 (배경 없음, 마크다운 렌더링) |
| `.chat-input-area` | 하단 입력 영역 |
| `.chat-input-wrapper` | 입력 + 버튼 래퍼 |

### 도구 호출 시각화

| 클래스 | 설명 |
|--------|------|
| `.agent-step` | 에이전트 스텝 컨테이너 |
| `.agent-step-header` | 스텝 헤더 (접기/펼치기) |
| `.agent-tool-call` | 도구 호출 블록 |
| `.agent-tool-result` | 도구 결과 블록 |

### 마크다운 렌더링

| 클래스 | 설명 |
|--------|------|
| `.msg-text h1`~`h6` | 제목 스타일 |
| `.msg-text pre` / `code` | 코드 블록 (다크 배경) |
| `.msg-text table` | 테이블 (테두리, 호버) |
| `.msg-text blockquote` | 인용문 (좌측 보더) |
| `.msg-text ul` / `ol` | 목록 스타일 |

### 설정

| 클래스 | 설명 |
|--------|------|
| `.settings-view` | 설정 뷰 래퍼 |
| `.settings-section` | 설정 섹션 그룹 |
| `.settings-row` | 설정 항목 행 |
| `.toggle` / `.toggle-on` | 토글 스위치 |
| `.field-input` / `.field-select` | 폼 입력 필드 |

### 기록/북마크

| 클래스 | 설명 |
|--------|------|
| `.history-view` | 기록 뷰 래퍼 |
| `.history-item` | 대화 항목 (호버, 액티브) |
| `.bookmark-item` | 북마크 항목 |
| `.tag` | 태그 칩 |

## 애니메이션

| 이름 | 용도 |
|------|------|
| `@keyframes fadeUp` | 메시지 등장 (위로 슬라이드) |
| `@keyframes blink` | 커서 깜빡임 |
| `@keyframes spin` | 로딩 스피너 |
| `@keyframes pulse` | 스트리밍 인디케이터 |

## 다크모드 전환

```css
:root { /* Light 테마 변수 */ }
:root[data-theme='dark'] { /* Dark 테마 변수 오버라이드 */ }
```

`SettingsView`에서 `document.documentElement.dataset.theme` 토글로 전환.

## 반응형

- 사이드패널 고정 너비 (Chrome 사이드패널 제약)
- 메시지 버블 `max-width: 85%`
- 코드 블록 가로 스크롤
- 모바일 미지원 (Chrome 확장 전용)

## 의존성

- Google Fonts: IBM Plex Sans KR (300-700), IBM Plex Mono (300-600)
- 외부 CSS 프레임워크 없음 (순수 CSS)
