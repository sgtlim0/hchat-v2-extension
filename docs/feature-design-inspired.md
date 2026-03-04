# 경쟁사 기반 신규 기능 설계안

> 경쟁사 2026 릴리즈 노트 분석 후 H Chat v3에 도입할 기능 4가지 선별
> 마지막 업데이트: 2026-03-04
> 현재 버전: v5.0
> 상태: ✅ 4개 기능 모두 완료 (v3.1)
> 참고: 이 문서는 v3.1 계획 문서입니다. 이후 v4.x~v5.0에서 추가 기능이 구현되었습니다.

## 분석 요약

### 경쟁사 주요 릴리즈 (2026.01~02)

| 날짜 | 기능 | 설명 |
|------|------|------|
| 01.06 | Thinking Depth | 모델별 사고 깊이 조절 (품질 vs 속도) |
| 01.08 | AI 도입 효과 측정 | ROI 분석 대시보드 |
| 01.19 | 고급 데이터 분석 | Excel/CSV 업로드, 차트 생성 |
| 01.30 | AI 슈퍼 가드레일 | 개인정보 감지/마스킹 |
| 01.30 | 문서 슈퍼 전처리 | 스캔 문서, 중첩 테이블 인식 |
| 02.02 | AI 이미지 생성 | 템플릿 기반 상용 이미지 |
| 02.04 | 실시간 사용량 모니터링 | 70% 초과 시 잔여 한도 표시 |
| 02.04 | Deep Research | 소스 포함 품질 리포트 생성 |
| 02.23 | Gemini 3.1 Pro | 최신 모델 추가 |
| 02.26 | 상업용 영상 생성 | 한국어 영상 템플릿 |
| 02.27 | Works+ 앱스토어 | 미니앱 9종 |

### H Chat 도입 가능성 평가

| 기능 | 적합도 | 이유 |
|------|--------|------|
| **Thinking Depth** | ★★★★★ | Claude extended thinking 이미 지원, UI만 추가 |
| **데이터 분석** | ★★★★☆ | 기존 PDF 도구 패턴 확장, CSV/Excel 분석 |
| **Deep Research** | ★★★★☆ | 기존 웹 검색 RAG 확장, 멀티스텝 리서치 |
| **사용량 알림** | ★★★★☆ | 기존 Usage 시스템에 임계치 알림 추가 |
| 이미지 생성 | ★★☆☆☆ | 별도 API 필요, 확장 프로그램 한계 |
| 영상 생성 | ★☆☆☆☆ | 확장 프로그램 범위 초과 |
| 앱스토어 | ★☆☆☆☆ | 플랫폼 수준, 확장 프로그램 부적합 |
| 가드레일 | ★★★☆☆ | 구현 가능하나 복잡도 높음 (추후 고려) |

---

## 도입 기능 4가지 (모두 완료)

### Feature 1: Thinking Depth Control (사고 깊이 조절) ✅ 완료 (v3.1)

**참고**: 경쟁사 01.06 — "Thinking Depth" 기능

**개요**: 모델의 사고 깊이를 3단계로 조절하여 품질과 속도 사이 트레이드오프 제공

**UI**: ChatView 하단 모델 선택 영역에 깊이 토글 추가
- ⚡ Fast (thinking 비활성화)
- 🧠 Normal (기본값)
- 🔬 Deep (extended thinking, budget_tokens 설정)

**대상 모델**: Claude Sonnet/Opus (extended thinking 지원 모델)

**동작**:
- Fast: `thinking` 파라미터 없음, 빠른 응답
- Normal: 기본 동작 (현재와 동일)
- Deep: `thinking: { type: "enabled", budget_tokens: 10000 }` 파라미터 추가

**구현 상태:**
- ✅ `ThinkingDepthSelector.tsx` — 3단계 토글 (Fast/Normal/Deep)
- ✅ Bedrock, OpenAI, Gemini 프로바이더 통합
- ✅ Claude Extended Thinking 지원 (budget_tokens)

---

### Feature 2: Data Analysis Tool (데이터 분석 도구) ✅ 완료 (v3.1)

**참고**: 경쟁사 01.19 — "고급 데이터 분석 도구"

**개요**: CSV/Excel 파일을 업로드하여 데이터 분석, 요약, 인사이트 추출

**UI**: Tools 탭에 "데이터 분석" 도구 카드 추가
1. 파일 업로드 (CSV, Excel)
2. 데이터 미리보기 (상위 5행 테이블)
3. 분석 유형 선택: 요약 통계 / 트렌드 분석 / 이상치 탐지
4. AI 분석 결과 표시 + Markdown 테이블

**파일 처리**:
- CSV: `FileReader` → 텍스트 파싱
- Excel: `SheetJS (xlsx)` 라이브러리로 파싱 → CSV 변환
- 최대 크기: 5MB, 최대 10,000행

**구현 상태:**
- ✅ `src/lib/dataAnalysis.ts` — CSV/Excel 파싱, Markdown 테이블
- ✅ ToolsView에 'dataAnalysis' 도구 추가
- ✅ 3가지 분석 유형: 요약 통계 / 트렌드 분석 / 이상치 탐지
- ✅ SVG 차트 시각화 (v3.4)

---

### Feature 3: Deep Research Mode (딥 리서치 모드) ✅ 완료 (v3.1)

**참고**: 경쟁사 02.04 — "Gemini Deep Research 모델"

**개요**: 질문에 대해 다단계 웹 검색 + 분석을 수행하여 소스 포함 리서치 리포트 생성

**UI**: ChatView 입력 영역에 "Deep Research" 토글 추가
1. 사용자가 질문 입력 + Deep Research 모드 활성화
2. 프로그레스: "검색 중... → 분석 중... → 리포트 작성 중..."
3. 결과: 구조화된 Markdown 리포트 + 출처 링크

**동작 흐름**:
1. 질문 → 검색 쿼리 3-5개 자동 생성
2. 각 쿼리로 웹 검색 (기존 RAG 파이프라인)
3. 검색 결과 종합 → AI에게 구조화된 리포트 요청
4. 출처 URL 포함 Markdown 렌더링

**구현 상태:**
- ✅ `src/lib/deepResearch.ts` — 3단계 파이프라인
- ✅ DuckDuckGo 검색 통합 + AI 쿼리 생성
- ✅ 스트리밍 리포트 생성 (v3.4)
- ✅ 출처 URL 자동 삽입

---

### Feature 4: Usage Alert (사용량 임계치 알림) ✅ 완료 (v3.1)

**참고**: 경쟁사 02.04 — "실시간 사용량 모니터링"

**개요**: 월간 사용량이 설정한 임계치를 초과하면 알림 배지 표시

**UI**:
- Settings > 일반 설정에 "월간 예산" 입력 필드 ($)
- 예산 70% 초과 시 탭 바에 경고 배지
- 예산 90% 초과 시 채팅 입력 영역에 경고 배너

**데이터**: 기존 `Usage.getRecords()` 활용, 월별 집계

**구현 상태:**
- ✅ `src/lib/usageAlert.ts` — 임계치 검사 (warn/critical)
- ✅ `UsageAlertBanner.tsx` — 경고 배너 (70%/90% 임계치)
- ✅ SettingsView에 예산 설정 UI
- ✅ 월간 예산 초과 시 배너 표시

---

## 구현 완료 요약

| Feature | 버전 | 상태 | 핵심 파일 |
|---------|------|------|----------|
| Thinking Depth | v3.1 | ✅ 완료 | ThinkingDepthSelector.tsx, providers/* |
| Data Analysis | v3.1 | ✅ 완료 | dataAnalysis.ts, SVG 차트 (v3.4) |
| Deep Research | v3.1 | ✅ 완료 | deepResearch.ts, DuckDuckGo 통합 |
| Usage Alert | v3.1 | ✅ 완료 | usageAlert.ts, UsageAlertBanner.tsx |

이 4가지 기능은 모두 **v3.1**에서 구현 완료되었으며, 이후 v3.4에서 차트 시각화 및 스트리밍 개선이 추가되었습니다.
