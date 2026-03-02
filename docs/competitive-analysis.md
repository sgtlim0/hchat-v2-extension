# 경쟁 분석 & H Chat 구현 방안

> 분석 일시: 2026-03-03
> 대상: H Chat — 기업용 AI 업무 도구 플랫폼
> 목적: H Chat v4 기능 로드맵 수립

---

## 1. 스크린샷 분석 요약

### 스크린샷 1: 메인 채팅

| 항목 | 내용 |
|------|------|
| **탭 구조** | 업무 비서, 문서 번역, 문서 작성, 텍스트 추출 |
| **핵심 메시지** | "실시간 검색, 사진 이해, 그림/차트 생성, 업무 대화 모두 OK!" |
| **비서 시스템** | "공식 비서" (8개) + "내가 만든 비서" (사용자 커스텀) |
| **공식 비서** | 신중한 독형이 (GPT-4o), 티커타카 장인 (GPT-4.1 nano), 문서 파일 검토 (PDF), 문서 번역, 파워포인트 기획, 본문 번역, 데이터 분석, 이메일 작성 |
| **H Chat 현황** | 페르소나 시스템(8개 프리셋) 있으나, **비서 마켓플레이스** 및 **커스텀 비서 빌더** 없음 |

### 스크린샷 2: 문서 번역 도구

| 항목 | 내용 |
|------|------|
| **핵심 기능** | 문서 디자인/형식 유지하면서 언어 번역 |
| **번역 엔진** | 자체 엔진 (89개 언어, 5000페이지/300MB) vs DeepL (32개 언어, 30MB/100만자) |
| **지원 포맷** | PDF, DOCX, DOC, PPTX, PPT, XLSX, XLS |
| **워크플로우** | ① 번역 시작 → ② 번역 결과 (2주간 다운로드) |
| **H Chat 현황** | 텍스트 번역(50개 언어) 있으나, **문서 파일 번역(포맷 유지)** 없음 |

### 스크린샷 3: 문서 작성 도구

| 항목 | 내용 |
|------|------|
| **핵심 기능** | 한글(HWP)/워드(DOCX) 문서 초안 AI 작성 |
| **5단계 파이프라인** | 프로젝트 선택 → 파일 선택 → 배경지식 제공 → 목차/내용 작성 → 파일 생성 |
| **프로젝트 관리** | 프로젝트별 문서 그룹핑, 문서 종류/최종 작성일/삭제 |
| **H Chat 현황** | 글쓰기 어시스턴트(textarea 변환) 있으나, **문서 생성/프로젝트 관리** 없음 |

### 스크린샷 4: OCR/텍스트 추출

| 항목 | 내용 |
|------|------|
| **핵심 기능** | 이미지에서 텍스트 자동 추출 |
| **지원 항목** | 명함, 영수증, 스크린샷, 손글씨, 사업자등록증 등 |
| **배치 처리** | 최대 20개 이미지 동시 업로드 |
| **다운로드** | 변환 파일 2주간 무료 다운로드 |
| **H Chat 현황** | Vision 기반 단일 이미지 OCR 있으나, **배치 OCR + 파일 다운로드** 없음 |

### 스크린샷 5: 마이페이지/요금제

| 항목 | 내용 |
|------|------|
| **요금제** | Starter (무료), 기업용 버전 별도 |
| **모델별 사용량** | OPENAI_CHAT_GPT4, GPT3_5, ASSISTANT, ASSISTANT_FILE, CLAUDE_DOC, DEEPL, DALL_E3, OCR |
| **토큰 충전** | 매 3시간 자동 충전 |
| **H Chat 현황** | 프로바이더별 비용 추적 + 월간 예산 있으나, **토큰 충전 모델** 없음 (사용자 API 키 방식) |

---

## 2. 기능 갭 분석

| 기능 | 경쟁사 | H Chat v3.6 | 갭 |
|------|---------|-------------|-----|
| AI 채팅 | ✅ GPT-4o, GPT-4.1 nano | ✅ Claude, GPT, Gemini (9모델) | **H Chat 우위** (모델 다양성) |
| 실시간 검색 | ✅ | ✅ DuckDuckGo + Google CSE | 동등 |
| 사진 이해 | ✅ | ✅ Vision (Claude, GPT) | 동등 |
| 데이터 분석 | ✅ | ✅ CSV/Excel + SVG 차트 | 동등 |
| 커스텀 비서 | ✅ 빌더 + 마켓플레이스 | ⚠️ 페르소나 프리셋만 | **큰 갭** |
| 문서 번역 | ✅ 포맷 유지, DeepL 연동 | ❌ 텍스트 번역만 | **큰 갭** |
| 문서 작성 | ✅ HWP/DOCX 생성, 프로젝트 관리 | ❌ 없음 | **큰 갭** |
| 배치 OCR | ✅ 20장 동시, 파일 다운로드 | ⚠️ 단일 이미지 Vision | **갭** |
| 차트/그림 생성 | ✅ DALL-E3 | ❌ 없음 | **갭** |
| PPT 기획 | ✅ | ❌ 없음 | **갭** |
| 오프라인 지원 | ❌ | ✅ 메시지 큐 + 자동 재전송 | **H Chat 우위** |
| 브라우저 통합 | ❌ 웹앱 | ✅ 사이드패널 + 콘텐츠 스크립트 | **H Chat 우위** |
| 딥 리서치 | ❌ | ✅ 3단계 자동 리서치 | **H Chat 우위** |
| AI 토론 | ❌ | ✅ 크로스 모델 3라운드 | **H Chat 우위** |
| 플러그인 | ❌ | ✅ webhook/JS/prompt 커스텀 | **H Chat 우위** |

---

## 3. 구현 우선순위

### 🔴 Priority 1: 커스텀 비서 빌더 (영향도 최대)

경쟁사의 핵심 차별점. 현재 H Chat 페르소나가 시스템 프롬프트만 변경하는 것에 비해, 비서는 **도구 + 프롬프트 + 파라미터 + 아바타**를 묶은 패키지.

#### 구현 범위

```
src/lib/assistantBuilder.ts     — 비서 CRUD (Storage 백업)
src/components/AssistantBuilder.tsx — 비서 생성/편집 UI
src/components/AssistantMarket.tsx  — 비서 목록 + 검색
```

#### 데이터 모델

```typescript
interface CustomAssistant {
  id: string
  name: string
  description: string
  icon: string              // 이모지 또는 아바타 URL
  systemPrompt: string      // 핵심 지시사항
  model: string             // 기본 모델 (예: claude-sonnet-4.6)
  tools: string[]           // 활성화할 도구 ID (플러그인 시스템 연동)
  parameters: {
    temperature?: number
    maxTokens?: number
    thinkingDepth?: ThinkingDepth
  }
  category: string          // 번역, 문서, 코드, 분석 등
  isBuiltIn: boolean        // 시스템 제공 vs 사용자 생성
  usageCount: number
  createdAt: number
  updatedAt: number
}
```

#### 기본 제공 비서 (8개)

| 비서명 | 모델 | 도구 | 시스템 프롬프트 핵심 |
|--------|------|------|---------------------|
| 📝 문서 검토관 | Claude Sonnet | read_page, summarize | 문서 검토 + 개선점 제안 |
| 🌐 번역 전문가 | GPT-4o | translate | 맥락 고려 자연스러운 번역 |
| 📊 데이터 분석가 | Claude Sonnet | calculate, web_search | CSV/Excel 분석 + 인사이트 |
| ✉️ 이메일 작성 | Gemini Flash | — | 비즈니스 이메일 초안 |
| 💻 코드 리뷰어 | Claude Opus | fetch_url | 코드 검토 + 개선 제안 |
| 📋 보고서 작성 | Claude Sonnet | web_search | 구조화된 보고서 초안 |
| 🎯 회의록 정리 | Gemini Flash | summarize | 회의 내용 구조화 |
| 🔍 리서치 비서 | Claude Sonnet | web_search, fetch_url | 심층 조사 + 출처 정리 |

#### UI/UX

- 채팅 탭 상단에 "비서 선택" 드롭다운 (현재 페르소나 → 비서로 확장)
- 프롬프트 탭에 "비서 빌더" 섹션 추가
- 비서 카드: 아이콘 + 이름 + 설명 + 사용 횟수

#### 연동 포인트

- 기존 `personas.ts` → `assistantBuilder.ts`로 마이그레이션
- 기존 `pluginRegistry.ts`의 도구를 비서에 바인딩
- `useChat.ts`에서 비서 선택 시 모델 + systemPrompt + tools 자동 설정

---

### 🟠 Priority 2: 문서 번역 (포맷 유지)

#### 구현 전략

Chrome Extension 환경 제약으로 서버사이드 문서 파싱은 불가. **클라이언트사이드 접근법**:

```
src/lib/docTranslator.ts        — 번역 오케스트레이터
src/lib/docParser.ts            — 문서 파싱 (docx, xlsx, pptx)
src/components/tools/DocTranslateTool.tsx — UI
```

#### 지원 포맷별 전략

| 포맷 | 라이브러리 | 전략 |
|------|-----------|------|
| **DOCX** | `mammoth.js` (16KB) | HTML 변환 → 텍스트 추출 → AI 번역 → HTML 재조합 → DOCX 재생성 |
| **XLSX** | `xlsx` (이미 사용 중) | 셀 텍스트 추출 → AI 번역 → 셀 교체 → 다운로드 |
| **PPTX** | `pptxgenjs` (50KB) | ZIP 해제 → XML 텍스트 추출 → 번역 → XML 교체 → 재압축 |
| **PDF** | `pdfjs-dist` (이미 사용 중) | 텍스트 추출 → 번역 → 새 PDF (포맷 근사, 완전 유지 어려움) |
| **TXT** | 네이티브 | 직접 번역 |

#### 번역 파이프라인

```
1. 파일 업로드 → 포맷 감지
2. 텍스트 청크 추출 (단락/셀/슬라이드 단위)
3. 소스/타겟 언어 선택 (자동 감지 + 수동)
4. AI 번역 (청크별 스트리밍, 진행률 표시)
5. 결과 재조합 → 파일 다운로드
```

#### 핵심 고려사항

- **청크 크기**: 1000자 단위로 분할 (API 토큰 한계 대응)
- **용어 일관성**: 이전 청크의 용어집을 다음 청크 시스템 프롬프트에 주입
- **비용 경고**: 대용량 파일 번역 시 예상 토큰/비용 미리 표시
- **진행률**: 전체 청크 수 대비 완료 비율 프로그레스바

---

### 🟠 Priority 3: 배치 OCR 강화

#### 현재 H Chat OCR

`ToolsView.tsx`의 OCR 도구 → 이미지 1장 업로드 → Vision API → 텍스트

#### 강화 방안

```
src/lib/batchOcr.ts                — 배치 OCR 오케스트레이터
src/components/tools/BatchOcrTool.tsx — UI (드래그앤드롭, 결과 목록)
```

| 기능 | 구현 |
|------|------|
| 다중 업로드 | `<input multiple>` + 드래그앤드롭, 최대 10장 |
| 병렬 처리 | `Promise.allSettled()` 3장씩 배치 (API 부하 조절) |
| 결과 관리 | 파일별 결과 카드 (원본 썸네일 + 추출 텍스트) |
| 내보내기 | 전체 결과 TXT/JSON 다운로드, 개별 복사 |
| 구조화 OCR | 명함 → JSON (이름, 회사, 전화, 이메일), 영수증 → 금액/항목 |

#### Vision 프롬프트 전략

```typescript
const OCR_PROMPTS = {
  general: '이미지의 모든 텍스트를 정확히 추출해주세요.',
  businessCard: '명함 정보를 JSON으로 추출: {name, company, title, phone, email, address}',
  receipt: '영수증 정보를 JSON으로 추출: {store, date, items: [{name, price}], total}',
  screenshot: '스크린샷의 UI 텍스트를 레이아웃 순서대로 추출해주세요.',
}
```

---

### 🟡 Priority 4: 문서 작성 도구

가장 복잡한 기능. 단계적 접근 필요.

#### Phase 1: 간단한 문서 생성 (v4.0)

```
src/lib/docGenerator.ts             — 문서 생성 엔진
src/components/tools/DocWriteTool.tsx — UI
```

- **입력**: 주제 + 문서 유형 (보고서/이메일/제안서/회의록) + 배경 정보
- **AI 생성**: 목차 자동 생성 → 사용자 확인 → 섹션별 콘텐츠 생성
- **출력**: Markdown → DOCX 변환 (`docx` npm 패키지, ~50KB)

#### Phase 2: 프로젝트 관리 (v4.1)

- 프로젝트 CRUD (Storage)
- 프로젝트별 문서 히스토리
- 버전 관리 (이전 생성본 보관)

#### Phase 3: 양식 기반 작성 (v4.2)

- 양식 템플릿 업로드 (DOCX)
- AI가 양식 구조 분석 → 빈칸 채우기
- HWP 지원은 서버 없이 불가 → DOCX만 지원

---

### 🟡 Priority 5: 이미지 생성 (DALL-E3)

#### 구현

```
src/lib/providers/openai-provider.ts — images.generate 엔드포인트 추가
src/components/tools/ImageGenTool.tsx — 프롬프트 입력 + 결과 갤러리
```

- OpenAI `images/generations` API (DALL-E 3)
- 프롬프트 입력 → 이미지 생성 (1024×1024, 1792×1024, 1024×1792)
- 결과 저장 (base64 → blob → IndexedDB 또는 다운로드)
- 비용 경고: $0.04/image (standard), $0.08/image (HD)

---

## 4. 기술 아키텍처 변경

### 새 파일 맵

```
src/
├── lib/
│   ├── assistantBuilder.ts      # 커스텀 비서 CRUD
│   ├── docTranslator.ts         # 문서 번역 파이프라인
│   ├── docParser.ts             # DOCX/XLSX/PPTX 파싱
│   ├── docGenerator.ts          # AI 문서 생성
│   └── batchOcr.ts              # 배치 OCR 오케스트레이터
├── components/
│   ├── AssistantBuilder.tsx      # 비서 생성/편집 UI
│   ├── AssistantMarket.tsx       # 비서 목록 (카드 그리드)
│   └── tools/
│       ├── DocTranslateTool.tsx  # 문서 번역 UI
│       ├── BatchOcrTool.tsx      # 배치 OCR UI
│       ├── DocWriteTool.tsx      # 문서 작성 UI
│       └── ImageGenTool.tsx      # 이미지 생성 UI
└── i18n/                        # 각 언어에 새 키 추가
```

### Storage 키 추가

```
hchat:assistants       — 커스텀 비서 목록
hchat:doc-projects     — 문서 프로젝트 목록
hchat:ocr-results      — OCR 결과 캐시
```

### 새 의존성

| 패키지 | 크기 | 용도 | 로딩 |
|--------|------|------|------|
| `mammoth` | ~16KB | DOCX → HTML 변환 | 동적 임포트 |
| `docx` | ~50KB | DOCX 생성 | 동적 임포트 |
| `pptxgenjs` | ~50KB | PPTX 파싱/생성 | 동적 임포트 |
| `file-saver` | ~3KB | Blob 다운로드 | 동적 임포트 |

모두 **동적 임포트**로 번들 사이즈 영향 최소화 (xlsx 패턴 재사용).

---

## 5. 구현 로드맵

```
v4.0 (1주차)
├── 커스텀 비서 빌더 + 기본 비서 8개
├── 배치 OCR (10장 동시, 구조화 OCR)
└── 40+ 테스트

v4.1 (2주차)
├── 문서 번역 (DOCX/XLSX/TXT, 청크 스트리밍)
├── 문서 작성 Phase 1 (Markdown → DOCX)
└── 40+ 테스트

v4.2 (3주차)
├── PPTX/PDF 번역 지원
├── 이미지 생성 (DALL-E 3)
├── 문서 프로젝트 관리
└── 30+ 테스트
```

---

## 6. H Chat 차별화 전략

경쟁사 대비 H Chat만의 강점 유지·강화:

| H Chat 강점 | 강화 방안 |
|-------------|----------|
| **브라우저 사이드패널** | 비서 빌더도 사이드패널에서 바로 사용 |
| **멀티 프로바이더** | 비서별 최적 모델 자동 배정 |
| **딥 리서치** | 비서에 딥 리서치 모드 통합 |
| **AI 토론** | "비서 vs 비서" 토론 모드 |
| **플러그인 시스템** | 비서가 커스텀 플러그인 도구 사용 가능 |
| **오프라인 지원** | 문서 번역/OCR 결과 오프라인 캐시 |
| **로컬 데이터** | API 키 직접 사용, 중간 서버 없음 (프라이버시) |
| **무료** | 경쟁사 유료 vs H Chat 사용자 API 키로 무제한 |

---

## 7. 리스크 & 제약

| 리스크 | 영향 | 대응 |
|--------|------|------|
| DOCX 포맷 유지 한계 | 복잡한 문서 레이아웃 손상 가능 | mammoth.js 변환 후 HTML 기반 재조합 |
| HWP 미지원 | 한국 시장에서 중요 | DOCX만 지원, HWP → DOCX 변환 안내 |
| 대용량 파일 메모리 | 300MB 파일 브라우저 메모리 초과 | 50MB 제한 + 청크 처리 |
| API 비용 폭주 | 문서 번역 시 대량 토큰 | 사전 비용 추정 + 확인 다이얼로그 |
| PDF 포맷 유지 | PDF 재생성 시 원본과 다름 | "텍스트만 번역" 모드 + 주의 문구 |
