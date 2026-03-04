# 경쟁사 기반 신규 기능 구현 방안

> `docs/feature-design-inspired.md` 설계안의 4가지 기능 구현 계획
> 마지막 업데이트: 2026-03-04
> 현재 버전: v5.0 기준
> 참고: 이 문서는 v3.1 구현 계획서입니다. 이후 v4.x~v5.0에서 추가 기능이 구현되었습니다.

---

## Feature 1: Thinking Depth Control (사고 깊이 조절) ✅ 완료 (v3.1)

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/providers/types.ts` | `SendParams`에 `thinkingDepth` 필드 추가 |
| `src/lib/providers/bedrock-provider.ts` | thinking 파라미터 조건부 삽입 |
| `src/components/chat/ThinkingDepthSelector.tsx` | **신규** — 3단계 토글 컴포넌트 |
| `src/components/ChatView.tsx` | `thinkingDepth` state + selector 렌더링 |
| `src/hooks/useChat.ts` | `sendMessage()`에 thinkingDepth 전달 |
| `src/i18n/ko.ts`, `en.ts` | i18n 키 추가 |
| `src/styles/global.css` | 토글 스타일 |

### 구현 상세

#### 1. SendParams 확장 (`types.ts`)

```typescript
interface SendParams {
  model: string
  messages: Message[]
  systemPrompt?: string
  maxTokens?: number
  signal?: AbortSignal
  thinkingDepth?: 'fast' | 'normal' | 'deep'  // 추가
}
```

#### 2. Bedrock Provider 수정 (`bedrock-provider.ts`)

`stream()` 메서드에서 `thinkingDepth === 'deep'`일 때 요청 body에 thinking 파라미터 추가:

```typescript
if (params.thinkingDepth === 'deep') {
  body.thinking = {
    type: 'enabled',
    budget_tokens: 10000,
  }
  // thinking 사용 시 temperature 제거 (Claude API 제약)
  delete body.temperature
}
```

`thinkingDepth === 'fast'`일 때는 `max_tokens`를 줄여 빠른 응답 유도 (예: 1024).

#### 3. ThinkingDepthSelector 컴포넌트 (~80줄)

```typescript
interface ThinkingDepthSelectorProps {
  depth: 'fast' | 'normal' | 'deep'
  onChange: (depth: 'fast' | 'normal' | 'deep') => void
  model: string  // 지원 모델만 활성화
}
```

- Claude Sonnet/Opus 모델만 Deep 옵션 활성화
- 비지원 모델 선택 시 자동으로 `normal`로 fallback
- 3개 버튼: ⚡ Fast / 🧠 Normal / 🔬 Deep

#### 4. ChatView 연결

```typescript
const [thinkingDepth, setThinkingDepth] = useState<'fast' | 'normal' | 'deep'>('normal')

// ModelSelector 옆에 ThinkingDepthSelector 배치
// sendMessage 호출 시 thinkingDepth 전달
```

### 테스트

- `ThinkingDepthSelector.test.tsx` — 렌더링, 클릭, 비지원 모델 비활성화
- `bedrock-provider.test.ts` — thinking body 파라미터 검증

### 구현 상태

- ✅ `ThinkingDepthSelector.tsx` 구현 (3단계: Fast/Normal/Deep)
- ✅ Bedrock, OpenAI, Gemini 3개 프로바이더 통합
- ✅ 테스트: `ThinkingDepthSelector.test.tsx`, provider 테스트
- ✅ i18n 키: `thinking.fast`, `thinking.normal`, `thinking.deep`

---

## Feature 2: Data Analysis Tool (데이터 분석 도구) ✅ 완료 (v3.1)

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/dataAnalysis.ts` | **신규** — CSV/Excel 파싱, 데이터 전처리 |
| `src/components/ToolsView.tsx` | `'dataAnalysis'` 도구 타입 + 핸들러 추가 |
| `src/i18n/ko.ts`, `en.ts` | i18n 키 추가 |
| `package.json` | `xlsx` 의존성 추가 |

### 구현 상세

#### 1. 데이터 파싱 모듈 (`dataAnalysis.ts`, ~200줄)

```typescript
export interface ParsedData {
  headers: string[]
  rows: string[][]
  rowCount: number
  fileName: string
}

export async function parseCSV(file: File): Promise<ParsedData>
export async function parseExcel(file: File): Promise<ParsedData>
export function dataToMarkdownTable(data: ParsedData, maxRows?: number): string
export function generateAnalysisPrompt(
  data: ParsedData,
  type: 'summary' | 'trend' | 'outlier'
): string
```

- CSV: `FileReader` + 직접 파싱 (콤마/탭 구분, 따옴표 이스케이프)
- Excel: `xlsx` 라이브러리 (`read()` → `sheet_to_json()`)
- 검증: 5MB 이하, 10,000행 이하, 최소 2열

#### 2. 분석 프롬프트 생성

```typescript
function generateAnalysisPrompt(data: ParsedData, type: 'summary' | 'trend' | 'outlier'): string {
  const preview = dataToMarkdownTable(data, 20) // 상위 20행 미리보기
  const prompts = {
    summary: `다음 데이터를 분석하여 요약 통계를 제공해주세요:\n\n${preview}\n\n포함 항목: 각 열의 데이터 타입, 기본 통계(평균/중앙값/최대/최소), 결측치 비율, 주요 패턴`,
    trend: `다음 데이터에서 시간적 트렌드와 패턴을 분석해주세요:\n\n${preview}\n\n포함 항목: 증가/감소 추세, 계절성, 이상 시점, 예측`,
    outlier: `다음 데이터에서 이상치와 특이점을 탐지해주세요:\n\n${preview}\n\n포함 항목: 통계적 이상치, 패턴 이탈, 가능한 원인, 데이터 품질 이슈`
  }
  return prompts[type]
}
```

#### 3. ToolsView 통합

기존 ToolId 유니온에 `'dataAnalysis'` 추가:

```typescript
type ToolId = 'summarize' | ... | 'dataAnalysis'
```

핸들러: 파일 업로드 → `parseCSV/parseExcel` → 미리보기 표시 → 분석 유형 선택 → `generateAnalysisPrompt()` → `provider.stream()` → 결과 표시

### 테스트

- `dataAnalysis.test.ts` — CSV 파싱, Excel 파싱, Markdown 변환, 프롬프트 생성, 검증 에러

### 구현 상태

- ✅ `src/lib/dataAnalysis.ts` — CSV/Excel 파싱, Markdown 테이블, 프롬프트 생성
- ✅ `ToolsView.tsx` — 'dataAnalysis' 도구 추가 (3가지 분석: 요약/트렌드/이상치)
- ✅ xlsx 라이브러리 동적 임포트 (lazy chunk)
- ✅ SVG 차트 시각화 (v3.4)
- ✅ 테스트: `dataAnalysis.test.ts`

---

## Feature 3: Deep Research Mode (딥 리서치 모드) ✅ 완료 (v3.1)

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/deepResearch.ts` | **신규** — 멀티스텝 리서치 오케스트레이션 |
| `src/components/chat/DeepResearchToggle.tsx` | **신규** — 토글 + 프로그레스 UI |
| `src/components/ChatView.tsx` | Deep Research 모드 state + 토글 연결 |
| `src/hooks/useChat.ts` | `deepResearch` 모드 분기 추가 |
| `src/i18n/ko.ts`, `en.ts` | i18n 키 추가 |
| `src/styles/global.css` | 프로그레스 스타일 |

### 구현 상세

#### 1. Deep Research 모듈 (`deepResearch.ts`, ~250줄)

```typescript
export interface ResearchProgress {
  step: 'generating_queries' | 'searching' | 'analyzing' | 'writing_report'
  detail: string
  progress: number  // 0-100
}

export interface ResearchResult {
  report: string          // Markdown 리포트
  sources: SourceRef[]    // 출처 목록
  queriesUsed: string[]   // 사용된 검색 쿼리
}

export interface SourceRef {
  url: string
  title: string
  snippet: string
}

export async function runDeepResearch(
  question: string,
  provider: AIProvider,
  model: string,
  onProgress: (progress: ResearchProgress) => void,
  signal?: AbortSignal
): Promise<ResearchResult>
```

#### 2. 리서치 플로우 (3단계)

**Step 1 — 검색 쿼리 생성**
```
사용자 질문 → AI에게 "이 질문을 조사하기 위한 검색 쿼리 3-5개 생성" 프롬프트
→ JSON 형태로 쿼리 목록 파싱
```

**Step 2 — 웹 검색 수행**
```
각 쿼리 → content script의 검색 엔진 활용 또는
background.js에서 fetch로 검색 API 호출
→ 결과 수집 (URL, 제목, 스니펫)
```

- 기존 `search-injector.ts`의 검색 결과 추출 로직 재사용
- `chrome.tabs.create({ url: searchUrl, active: false })` → content script로 결과 추출 → 탭 닫기
- 또는 DuckDuckGo Instant Answer API (키 불필요) 활용

**Step 3 — 리포트 생성**
```
수집된 검색 결과 + 원본 질문
→ AI에게 "구조화된 리서치 리포트 작성" 프롬프트
→ Markdown 렌더링 + 출처 링크
```

#### 3. ChatView 연결

```typescript
const [deepResearchMode, setDeepResearchMode] = useState(false)
const [researchProgress, setResearchProgress] = useState<ResearchProgress | null>(null)

// DeepResearchToggle을 ChatInputArea 위에 배치
// deepResearchMode일 때 sendMessage 대신 runDeepResearch 호출
```

#### 4. 프로그레스 UI

- 3단계 스텝 인디케이터 (체크 / 로딩 / 대기)
- 각 단계 상태 텍스트: "검색 쿼리 생성 중..." → "웹 검색 중 (3/5)..." → "리포트 작성 중..."
- 취소 버튼 (AbortController)

### 테스트

- `deepResearch.test.ts` — 쿼리 생성 파싱, 리포트 생성, 에러 처리, 취소
- `DeepResearchToggle.test.tsx` — 토글 상태, 프로그레스 렌더링

### 구현 상태

- ✅ `src/lib/deepResearch.ts` — 3단계 파이프라인 (쿼리 생성 → DuckDuckGo 검색 → AI 리포트)
- ✅ `DeepResearchToggle.tsx` — 토글 + 프로그레스 UI
- ✅ 스트리밍 리포트 생성 (v3.4)
- ✅ 출처 링크 자동 삽입
- ✅ 테스트: `deepResearch.test.ts`

---

## Feature 4: Usage Alert (사용량 임계치 알림) ✅ 완료 (v3.1)

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/usageAlert.ts` | **신규** — 임계치 검사 + 알림 로직 |
| `src/components/chat/UsageAlertBanner.tsx` | **신규** — 경고 배너 컴포넌트 |
| `src/components/SettingsView.tsx` | 예산 설정 UI 추가 |
| `src/hooks/useConfig.ts` | Config 타입에 budget 필드 추가 |
| `src/i18n/ko.ts`, `en.ts` | i18n 키 추가 |
| `src/styles/global.css` | 배너 스타일 |

### 구현 상세

#### 1. Config 확장

```typescript
interface Config {
  // 기존 필드...
  budget?: {
    monthly: number       // 월간 예산 ($), 기본값 0 (비활성)
    warnThreshold: number // 경고 임계치 (%), 기본값 70
    critThreshold: number // 위험 임계치 (%), 기본값 90
  }
}
```

#### 2. 사용량 알림 모듈 (`usageAlert.ts`, ~80줄)

```typescript
export interface UsageAlertState {
  level: 'none' | 'warn' | 'critical'
  currentCost: number
  budget: number
  percentage: number
  remaining: number
}

export async function checkUsageAlert(config: Config): Promise<UsageAlertState> {
  if (!config.budget?.monthly) return { level: 'none', ... }

  const summary = await Usage.getSummary(30)
  const currentCost = summary.totalCost
  const budget = config.budget.monthly
  const percentage = (currentCost / budget) * 100

  const level =
    percentage >= config.budget.critThreshold ? 'critical' :
    percentage >= config.budget.warnThreshold ? 'warn' : 'none'

  return { level, currentCost, budget, percentage, remaining: budget - currentCost }
}
```

#### 3. UsageAlertBanner 컴포넌트 (~60줄)

```typescript
interface UsageAlertBannerProps {
  alert: UsageAlertState
  onDismiss?: () => void
}
```

- `warn`: 노란색 배너 — "월간 예산의 {n}%를 사용했습니다 (잔여 ${remaining})"
- `critical`: 빨간색 배너 — "예산 초과 임박! ${remaining} 남음"
- 프로그레스 바 표시 (사용률 시각화)
- 닫기 버튼 (세션 내 숨김)

#### 4. 통합 위치

- **ChatView**: 채팅 영역 상단에 배너 (critical만)
- **SettingsView**: 일반 설정에 "월간 예산" 섹션 추가

#### 5. SettingsView 예산 설정

```typescript
// 예산 설정 섹션
<div className="settings-section">
  <h3>{t('settings.budgetTitle')}</h3>
  <label>{t('settings.monthlyBudget')}</label>
  <input type="number" min="0" step="10" value={draft.budget?.monthly ?? 0} />
  <label>{t('settings.warnThreshold')}</label>
  <input type="number" min="50" max="100" value={draft.budget?.warnThreshold ?? 70} />
</div>
```

### 테스트

- `usageAlert.test.ts` — 임계치 판정 (none/warn/critical), 비활성 시 none, 경계값
- `UsageAlertBanner.test.tsx` — 레벨별 렌더링, 닫기 동작

### 구현 상태

- ✅ `src/lib/usageAlert.ts` — 임계치 검사 (warn/critical)
- ✅ `UsageAlertBanner.tsx` — 경고 배너 (70%/90% 임계치)
- ✅ `SettingsView.tsx` — 월간 예산 설정 UI
- ✅ `Config.budget` 타입 추가
- ✅ 테스트: `usageAlert.test.ts`, `UsageAlertBanner.test.tsx`

---

## 구현 완료 요약 (v3.1)

| Feature | 상태 | 버전 | 핵심 파일 |
|---------|------|------|----------|
| Thinking Depth | ✅ 완료 | v3.1 | ThinkingDepthSelector.tsx, providers/* |
| Data Analysis | ✅ 완료 | v3.1 | dataAnalysis.ts, ToolsView.tsx |
| Deep Research | ✅ 완료 | v3.1 | deepResearch.ts, DeepResearchToggle.tsx |
| Usage Alert | ✅ 완료 | v3.1 | usageAlert.ts, UsageAlertBanner.tsx |

### 최종 작업량

| Feature | 신규 파일 | 수정 파일 | 실제 코드량 | 테스트 |
|---------|----------|----------|------------|--------|
| Thinking Depth | 1 | 5 | ~200줄 | 10+ tests |
| Usage Alert | 2 | 3 | ~200줄 | 12+ tests |
| Data Analysis | 1 | 2 | ~350줄 | 15+ tests |
| Deep Research | 2 | 3 | ~450줄 | 18+ tests |
| **합계** | **6** | **13** | **~1,200줄** | **55+ tests** |

### 공통 작업

- 각 Feature 완료 후: `npm run build` + `npm test` 검증
- i18n 키는 ko.ts/en.ts에 feature별 섹션으로 추가
- CSS 변수 활용 (기존 디자인 토큰: `$primary`, `$warning`, `$danger` 등)
- 화면 설계: `v3.pen` 참조 (Feature1~4 프레임)

---

## 리스크 및 대안

| 리스크 | 대안 |
|--------|------|
| Excel 파싱 번들 크기 증가 (xlsx ~300KB) | dynamic import로 lazy 로드 |
| Deep Research 검색 API 제한 | DuckDuckGo API fallback, 검색 횟수 제한 |
| Extended thinking API 변경 | feature flag로 비활성화 가능하게 |
| 예산 계산 정확도 (토큰 추정) | 실제 API 응답 usage 필드 활용 (가능한 경우) |
