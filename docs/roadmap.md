# H Chat 로드맵

> 마지막 업데이트: 2026-03-05
> 현재 버전: v5.4

---

## 완료된 작업 요약

### v3.x (기초~고도화)

| Phase | 버전 | 요약 |
|-------|------|------|
| Phase 1 | v3.0 | i18n (ko/en, 380+ keys), 테스트 인프라 구축 (203 tests), ESLint flat config |
| Phase 2 | v3.0 | CSV 내보내기, 프롬프트 import/export, 검색 최적화, 라이트 테마, safeEvalMath, 코드 스플리팅 |
| Phase 3 | v3.1 | Thinking Depth (3단계), 데이터 분석 (CSV/Excel), 딥 리서치, 사용량 알림 |
| Phase 4 | v3.2 | 테스트 확대 (245개), ToolsView 리팩토링, ErrorBoundary, ESLint 제로 |
| Phase 5 | v3.3 | 3개 프로바이더 Thinking Depth 통합, 키보드 내비게이션, models.ts 레거시 제거, streaming 에러 복구 |
| Phase 6 | v3.4 | 딥 리서치 스트리밍, 데이터 분석 SVG 차트, 누락 화면 보완 |
| Phase 7 | v3.5 | ChatGPT/Claude 대화 가져오기, 음성 UX, 일본어 i18n, Webhook 알림, 검색 인덱싱 |
| Phase 8 | v3.6 | 오프라인 지원, 플러그인 시스템 (webhook/JS/prompt), 내장 도구 확장 (365 tests) |

### v4.0 — 커스텀 비서 + 배치 OCR ✅

- **커스텀 비서 빌더**: 8개 내장 비서, CRUD, 사용 횟수 추적, useChat 통합
- **배치 OCR**: 10장 동시 업로드, 4가지 모드 (일반/명함/영수증/스크린샷), 구조화 JSON 추출
- 421 tests, 27 files

### v4.1 — 문서 번역 + 문서 작성 ✅

- **문서 번역**: TXT/CSV/XLSX 지원, 1000자 청크 분할, 용어 일관성 유지, 비용 추정
- **문서 작성**: 5가지 유형 (보고서/이메일/제안서/회의록/메모), 3단계 파이프라인, DOCX 내보내기

### v4.2 — 이미지 생성 ✅

- **DALL-E 3**: 3가지 크기, Standard/HD 품질, Vivid/Natural 스타일, 비용 추정, 세션 히스토리
- 498 tests, 30 files

### v4.5 — 추가 UX 개선 ✅ (2026-03-03 완료)

| 기능 | 설명 |
|------|------|
| 번역 진행 상황 표시 | timeFormat.ts 유틸리티 (ko/en/ja 시간 포맷, ETA 계산), DocTranslateTool 경과 시간 + 예상 남은 시간 표시, performance.now() 기반 청크 타이밍 |
| 템플릿 갤러리 공유 | docTemplateStore.ts exportTemplates/importTemplates 메서드, 갤러리 탭 내보내기/가져오기 버튼, JSON 포맷 (version 1), 중복 건너뛰기, 최대 10개 제한 |
| 품질 | 16개 도구, 649 tests (36 files), 710+ i18n 키 (ko/en/ja), ESLint 0 errors |

### v4.4 — UX 개선 ✅

| 기능 | 설명 |
|------|------|
| 문서 번역 중단 | AbortSignal 기반 청크별 번역 중단, 부분 결과 보존 |
| 프로젝트 검색 + 필터 | DocProjectList 검색 입력 + 타입별 필터 칩 (보고서/이메일/제안서/회의록/메모) |
| 템플릿 갤러리 | docTemplateStore.ts — DOCX 템플릿 CRUD, Base64 인코딩, chrome.storage 저장, 갤러리 탭 |
| 도구 | 16개 도구, 620 tests (35 files), 700+ i18n 키 (ko/en/ja) |

### v4.3 — 문서 도구 확장 ✅

- **PPTX 번역**: JSZip으로 ZIP 해제 → XML `<a:t>` 텍스트 추출 → 번역 → 재조립 (.pptx 출력)
- **PDF 번역**: pdfjs-dist 텍스트 추출 → 번역 → Markdown 출력 (레이아웃 미보존 안내)
- **문서 프로젝트 관리**: CRUD + 버전 관리 (최대 10 FIFO), 프로젝트 저장/열기/복원
- **템플릿 문서 작성**: DOCX 업로드 → `{{필드}}` 추출 → AI 자동 제안 → 섹션별 AI 확장 → MD/DOCX 다운로드
- 589 tests, 34 files, 16개 도구

---

## 현재 수치 (v5.4)

| 항목 | 수치 |
|------|------|
| 테스트 | 1210 tests, 59 files |
| 컴포넌트 | 57 .tsx 파일 (ChatInputArea, AssistantSelector, ModelSelector 수정) |
| lib 모듈 | 50개 (messageSearch.ts BM25 통합) |
| 도구 | 17개 (요약, 멀티탭, 번역, 글쓰기, 문서작성, YouTube, OCR, 배치OCR, 문법, 댓글분석, PDF, 인사이트, 데이터분석, 이미지생성, 문서번역, 템플릿문서, PPT기획) |
| 언어 | 3개 (ko/en/ja), 730+ i18n keys |
| AI 프로바이더 | 3개 (Bedrock/OpenAI/Gemini) |
| 모델 | 9개 (Claude Sonnet 4.6/Opus 4.6/Haiku 4.5, GPT-4o/4o-mini/o1-mini, Gemini 2.0 Flash/1.5 Pro/1.5 Flash) |
| 비서 | 20개 내장 (6카테고리) + 커스텀 빌더 |
| 번들 | sidepanel ~132KB (46KB gzip), 가상 스크롤 (react-window) |

---

### v5.0 — UX 고도화 ✅ (2026-03-03 완료)

| 기능 | 설명 |
|------|------|
| 비서 마켓플레이스 | 내장 비서 8→20개 (6카테고리), 검색/필터/인기순, JSON 내보내기/가져오기 |
| PPT 기획 도구 | 주제 → AI 목차 → 슬라이드 콘텐츠 → PPTX 다운로드 (JSZip OOXML) |
| AI 가드레일 | PII 5종 (이메일/전화/주민번호/카드/계좌) 자동 감지, 마스킹 전송, 경고 배너 |
| 비서 vs 비서 토론 | DebateParticipant.assistantId 추가, 비서 systemPrompt 주입 |
| 대화 템플릿 | ChatTemplateStore CRUD, {{변수}} 치환, 순차 실행, JSON 공유 |
| 품질 | 17개 도구, 741 tests (40 files), 730+ i18n 키 (ko/en/ja) |

---

### v5.2 — 성능 & 접근성 강화 ✅ (2026-03-05 완료)

대화량 많은 환경에서의 성능 최적화와 WCAG AA 접근성 준수에 집중.

| 항목 | 설명 | 결과 |
|------|------|------|
| 가상 스크롤 | react-window VariableSizeList, MsgBubble React.memo, MarkdownRenderer useMemo | 50+ 메시지 60fps |
| 접근성 WCAG AA | CSS 대비 개선, focus-visible, ARIA labels, 동적 lang 속성 | AA 준수 |
| 테스트 확대 | 인프라 146 + 에이전트/훅 106 신규 | 993 tests, 50 files |
| 빌드 | sidepanel ~132KB (46KB gzip) | 성공 |

### v5.1 — 성능 & 코드 품질 정리 ✅ (2026-03-05 완료)

번들 크기 최적화와 코드 일관성 개선에 집중한 정리 작업.

| 항목 | 설명 | 결과 |
|------|------|------|
| 번들 최적화 | react-markdown/remark-gfm/rehype-highlight 제거, 커스텀 MD 렌더러 유지 | ~130KB 절감 (96 packages 제거) |
| 코드 일관성 | PROVIDER_COLORS 상수를 types.ts로 중앙화 (7개 컴포넌트 업데이트) | 중복 제거 |
| i18n 확대 | toolbar.ts i18n 통합 (tSync 패턴, ja locale 추가, 6 keys) | 3개 언어 완전 지원 |
| 기술 부채 정리 | PersonaSelector 레거시 제거, CSS 변수 정리 (7개 제거), i18n 키 정리 (10개 제거) | 유지보수성 개선 |

### v5.3 — AI 자동 추천 & 검색 고도화 ✅ (2026-03-05 완료)

AI 자동 추천 시스템과 검색 품질 개선에 집중.

| 항목 | 설명 | 결과 |
|------|------|------|
| AI 자동 추천 | intentRouter.ts — 9가지 의도 감지, 비서/도구 자동 추천 (281줄) | 완료 |
| 사용 패턴 학습 | userPreferences.ts — 가중 빈도 추적 + 시간 감쇠, top 3 추천 (143줄) | 완료 |
| 컨텍스트 자동 요약 | conversationSummarizer.ts — 20+ 메시지 요약, FIFO 캐시, 시스템 프롬프트 주입 (162줄) | 완료 |
| BM25 검색 개선 | bm25.ts — BM25 스코어링 + IDF, combinedScore (70%+30%) (108줄) | 완료 |
| 테스트 | 4개 lib + 4개 test 파일 추가 | 1148 tests, 54 files |

### v5.4 — 추천 UI 통합 & 검색 고도화 ✅ (2026-03-05 완료)

v5.3에서 구축한 추천 엔진을 UI 컴포넌트에 통합하고 검색 품질을 개선.

| 항목 | 설명 | 결과 |
|------|------|------|
| ChatInputArea 의도 추천 칩 | detectIntent() 실시간 300ms 디바운스, 의도별 아이콘 칩, onApplyIntent 콜백 | 완료 |
| useChat 사용 추적 + 자동 요약 | trackUsage() 모델/비서 추적, 20+ 메시지 자동 요약, 시스템 프롬프트 주입 | 완료 |
| 비서/모델 추천 배지 | AssistantSelector ⭐ 추천 + 카테고리 탭, ModelSelector ⭐ 배지 | 완료 |
| BM25 검색 통합 | messageSearch.ts calculateScore를 BM25 기반으로 교체, trigram 유지 | 완료 |
| 테스트 | 5개 test 파일 추가 | 1210 tests, 59 files |

### v5.5 — 확장성 (예정)

추가 품질 개선과 사용자 피드백 반영에 집중한다.

| 항목 | 설명 | 목표 |
|------|------|------|
| E2E 테스트 | Playwright로 핵심 사용자 흐름 (채팅, 도구, 설정) 검증 | 10+ E2E 시나리오 |
| 사용자 피드백 반영 | Chrome Web Store 피드백 분석 및 개선 | 버그 수정 |
| 성능 모니터링 | 대용량 대화 메모리 프로파일링 | 메모리 누수 제거 |

---

| 항목 | 설명 |
|------|------|
| Firefox/Edge 지원 | WebExtension API 호환 레이어, 브라우저별 빌드 |
| 팀 공유 기능 | 대화/비서/프롬프트를 팀원과 공유 (WebRTC 또는 공유 스토리지) |
| MCP 서버 연동 | Model Context Protocol 지원으로 외부 도구 연결 |
| 로컬 LLM 프로바이더 | Ollama 등 로컬 모델 프로바이더 추가 |

---

## 기술 부채

| 항목 | 현황 | 우선순위 |
|------|------|----------|
| PersonaSelector 레거시 | ✅ 완료 (2026-03-05) — AssistantSelector로 교체, PersonaSelector.tsx 제거됨 | 해결 |
| CSS 변수 정리 | ✅ 완료 (2026-03-05) — 미사용 변수 7개 제거 (dark 24→17, light 22→15) | 해결 |
| i18n 키 동기화 | ✅ 완료 (2026-03-05) — toolbar.ts i18n 통합 (ja 추가, 6 keys), 미사용 키 10개 제거 | 해결 |
| react-markdown 의존성 | ✅ 완료 (2026-03-05) — react-markdown/remark-gfm/rehype-highlight 제거 (~130KB 절감, 96 packages) | 해결 |
| PROVIDER_COLORS 중복 | ✅ 완료 (2026-03-05) — types.ts 중앙화, 7개 컴포넌트 업데이트 | 해결 |
| HWP 미지원 | 서버 없이 HWP 파싱 불가, DOCX만 지원 중 | 수용 (안내 문구 제공) |
| PDF 포맷 유지 한계 | pdfjs-dist로 텍스트 추출은 가능하나 원본 레이아웃 재생성 불완전 | 중간 |
| 대용량 파일 메모리 | 브라우저 메모리 한계로 50MB 제한 필요 | 중간 |

---

## 리스크 & 제약

| 리스크 | 영향도 | 현재 대응 | 추가 대응 필요 |
|--------|--------|----------|----------------|
| Chrome Extension 환경 제약 | 높음 | 서버사이드 불가 → 클라이언트 처리 | PPTX/PDF 파싱 시 Web Worker 활용 검토 |
| DOCX 포맷 유지 한계 | 중간 | mammoth.js HTML 기반 재조합 | 복잡한 레이아웃 손상 시 사용자 경고 |
| API 비용 폭주 | 높음 | 사전 비용 추정 + 확인 다이얼로그 | 문서 번역 시 청크별 중단 기능 |
| 대용량 파일 메모리 초과 | 중간 | 50MB 제한 + 청크 처리 | Web Worker 오프로딩, 스트림 처리 |
| PDF 재생성 품질 | 중간 | "텍스트만 번역" 모드 + 주의 문구 | 원본 대비 미리보기 제공 |
| HWP 미지원 | 낮음 | DOCX만 지원, 변환 안내 | 한국 시장 피드백에 따라 재검토 |
| 프로바이더 API 변경 | 중간 | fetch 직접 사용으로 SDK 의존 없음 | API 버전 핀닝, 변경 감지 테스트 |
| 브라우저 호환성 | 낮음 | Chrome 전용 (MV3) | Firefox/Edge 확장 시 호환 레이어 필요 |
