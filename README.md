# H Chat v2 — Sider 스타일 AI 올인원 확장 프로그램

## 구현된 Sider 기능 목록

| Sider 기능 | H Chat 구현 | 위치 |
|---|---|---|
| AI 채팅 사이드바 | ✅ 스트리밍 채팅 | 채팅 탭 |
| 다중 모델 지원 | ✅ Claude + GPT + Gemini | 모델 선택기 |
| 그룹 채팅 (비교) | ✅ 최대 7개 모델 동시 | 그룹 탭 |
| 프롬프트 라이브러리 | ✅ / 단축키 + 저장 | 프롬프트 탭 |
| 페이지 요약 | ✅ 현재 탭 내용 추출 | 도구 → 페이지 요약 |
| YouTube 요약 | ✅ 자막 추출 + AI 분석 | 도구 → YouTube 요약 |
| 텍스트 번역 | ✅ 10개 언어 | 도구 → 번역 |
| 글쓰기 도구 | ✅ 11가지 액션 | 도구 → 글쓰기 |
| 문법 교정 | ✅ AI 기반 교정 | 도구 → 문법 교정 |
| 이미지 OCR | ✅ Claude/GPT Vision | 도구 → OCR |
| 텍스트 선택 툴바 | ✅ 6가지 즉석 액션 | 웹페이지 텍스트 선택 시 |
| 컨텍스트 메뉴 | ✅ 우클릭 → AI 액션 | 우클릭 메뉴 |
| 대화 기록 | ✅ 로컬 영구 저장 | 기록 탭 |
| PDF 채팅 | ✅ 파일 업로드 | 채팅 → 파일 첨부 |
| 이미지 채팅 | ✅ Vision 모델 | 채팅 → 파일 첨부 |
| 팝업 퀵 런처 | ✅ API 상태 + 빠른 실행 | 확장 아이콘 클릭 |

## 빌드 & 설치

```bash
npm install
npm run build

# Chrome: chrome://extensions → 개발자 모드 ON
# "압축 해제된 확장 프로그램 로드" → dist/ 폴더 선택
```

## API 키 설정 (택 1 이상)

| 제공자 | 발급 위치 | 지원 모델 |
|---|---|---|
| Anthropic | console.anthropic.com | Claude Sonnet, Opus, Haiku |
| OpenAI | platform.openai.com/api-keys | GPT-4o, GPT-4o mini |
| Google | aistudio.google.com/app/apikey | Gemini 2.0 Flash, 1.5 Pro |

## 아키텍처

```
[아이콘 클릭 / 컨텍스트 메뉴]
         ↓
[Background SW] ── 알람, 컨텍스트 메뉴, 이벤트
         ↓
[Side Panel] ─── 6탭 UI
  ├─ 💬 채팅 (스트리밍, 파일, 프롬프트 라이브러리)
  ├─ 🤖 그룹 채팅 (7개 모델 동시 비교)
  ├─ 🛠 도구 (요약·번역·글쓰기·YouTube·OCR)
  ├─ 📚 프롬프트 라이브러리 (/ 단축키)
  ├─ 🕐 대화 기록 (로컬 영구 저장)
  └─ ⚙️ 설정 (3개 AI 제공자 API 키)

[Content Script] (모든 웹페이지)
  └─ 텍스트 선택 → 플로팅 툴바 (설명·번역·요약·다듬기·격식체·교정)
```

## 보안

- API 키: `chrome.storage.local` (암호화된 로컬 저장)
- 모든 API 호출: HTTPS (api.anthropic.com, api.openai.com, generativelanguage.googleapis.com)
- 대화 데이터: 완전 로컬 저장, 외부 서버 없음
- `anthropic-dangerous-direct-browser-access: true` 헤더로 브라우저 직접 호출 허용
