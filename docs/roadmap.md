# H Chat 로드맵

> 마지막 업데이트: 2026-03-03
> 현재 버전: v4.5

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

## 현재 수치 (v4.5)

| 항목 | 수치 |
|------|------|
| 테스트 | 649 tests, 36 files |
| 도구 | 16개 (요약, 멀티탭, 번역, 글쓰기, 문서작성, YouTube, OCR, 배치OCR, 문법, 댓글분석, PDF, 인사이트, 데이터분석, 이미지생성, 문서번역, 템플릿문서) |
| 언어 | 3개 (ko/en/ja), 710+ i18n keys |
| AI 프로바이더 | 3개 (Bedrock/OpenAI/Gemini) |
| 모델 | 9개 (Claude Sonnet 4.6/Opus 4.6/Haiku 4.5, GPT-4o/4o-mini/o1-mini, Gemini 2.0 Flash/1.5 Pro/1.5 Flash) |
| 비서 | 8개 내장 + 커스텀 빌더 |
| 번들 | sidepanel 86KB (31KB gzip), 7 lazy chunks + xlsx/docx/jszip 동적 임포트 |

---

### v5.0 — UX 고도화 (예정)

경쟁사 갭 분석에서 아직 미해결인 항목과 사용자 경험 개선을 중심으로 한다.

| 항목 | 설명 | 근거 |
|------|------|------|
| 비서 마켓플레이스 | 비서 공유/검색/추천, 인기순 정렬, 카테고리 필터 | 경쟁사 대비 큰 갭 |
| PPT 기획 도구 | 슬라이드 구조 생성 → pptxgenjs PPTX 출력 | 경쟁사 대비 갭 |
| AI 가드레일 | 개인정보 감지 (이메일/전화/주민번호) → 자동 마스킹 후 전송 | 기업용 필수 |
| 비서 vs 비서 토론 | 기존 토론 모드에 커스텀 비서 연동 | 차별화 강화 |
| 대화 템플릿 | 자주 쓰는 대화 흐름을 템플릿으로 저장/재사용 | UX 개선 |

**예상 테스트**: +50 tests

---

### v5.1 — 성능 & 안정성 (예정)

테스트 커버리지 확대와 실사용 안정성 확보에 집중한다.

| 항목 | 설명 | 목표 |
|------|------|------|
| 테스트 커버리지 확대 | 주요 컴포넌트 (ChatView, ToolsView, SettingsView) 테스트 보강 | 80% 커버리지 |
| E2E 테스트 | Playwright로 핵심 사용자 흐름 (채팅, 도구, 설정) 검증 | 10+ E2E 시나리오 |
| 대용량 대화 최적화 | 1000+ 메시지 대화에서 가상 스크롤, 메모리 관리 | 60fps 유지 |
| 접근성 강화 | WCAG AA 준수, 스크린리더 호환, 고대비 모드 | AA 등급 |
| 번들 최적화 | tree-shaking 개선, 불필요한 polyfill 제거 | gzip -10% |

---

### v5.2 — 확장성 (장기)

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
| PersonaSelector 레거시 | AssistantSelector로 교체되었으나 PersonaSelector.tsx (129줄) 파일 잔존 | 낮음 |
| HWP 미지원 | 서버 없이 HWP 파싱 불가, DOCX만 지원 중 | 수용 (안내 문구 제공) |
| PDF 포맷 유지 한계 | pdfjs-dist로 텍스트 추출은 가능하나 원본 레이아웃 재생성 불완전 | 중간 |
| 대용량 파일 메모리 | 브라우저 메모리 한계로 50MB 제한 필요 | 중간 |
| CSS 변수 정리 | global.css (40KB)에 미사용 변수 잔존 가능 | 낮음 |
| i18n 키 동기화 | ko/en/ja 3개 파일 간 키 누락 자동 검증 도구 없음 | 중간 |

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
