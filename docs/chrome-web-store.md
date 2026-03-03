# Chrome Web Store 배포 가이드

> 마지막 업데이트: 2026-03-03
> 현재 버전: v4.5

## 기본 정보

- **이름**: H Chat — Multi-AI Sidebar Assistant
- **짧은 설명** (132자 이내): AWS Bedrock, OpenAI, Gemini를 하나의 사이드바에서. 커스텀 비서, 문서 번역/작성/템플릿, 이미지 생성, 딥 리서치.
- **카테고리**: Productivity
- **언어**: 한국어, English, 日本語

## 상세 설명

H Chat은 Chrome 사이드바에서 여러 AI 모델과 고급 도구를 사용할 수 있는 확장 프로그램입니다.

### 주요 기능 (v4.5)
- **멀티 AI 지원**: AWS Bedrock (Claude), OpenAI (GPT), Google Gemini (9개 모델)
- **커스텀 비서**: 8개 내장 비서 + 나만의 비서 만들기 (도구, 프롬프트, 파라미터 커스터마이징)
- **문서 번역**: TXT/CSV/XLSX/PPTX/PDF 포맷 유지 번역, 용어 일관성, 비용 추정, 중단 기능, 실시간 진행 상황 (경과 시간 + ETA)
- **문서 작성**: AI 자동 문서 생성 (보고서/이메일/제안서/회의록/메모 → DOCX), 프로젝트 관리 (검색+필터)
- **템플릿 문서**: DOCX 템플릿 업로드 → {{필드}} 자동 추출 → AI 내용 생성, 갤러리 저장/재사용, 템플릿 공유 (JSON 내보내기/가져오기)
- **배치 OCR**: 10장 동시 업로드, 명함/영수증 구조화 추출 (4가지 모드)
- **이미지 생성**: DALL-E 3 (3가지 크기, HD/Standard 품질, Vivid/Natural 스타일, 세션 히스토리)
- **데이터 분석**: CSV/Excel 업로드 → SVG 차트 시각화 + AI 인사이트
- **딥 리서치**: 3단계 자동 리서치 (쿼리 생성 → 웹 검색 → 출처 포함 리포트)
- **그룹 채팅**: 여러 AI 모델 동시 질문, 응답 비교
- **AI 토론**: 두 AI 모델 간 3라운드 자동 토론
- **프롬프트 라이브러리**: 프롬프트 저장, 카테고리 분류, import/export
- **Writing Assistant**: 웹페이지 텍스트 선택 → 교정/요약/번역/톤변환
- **사용량 관리**: 비용 추적, 월간 예산, Webhook 알림
- **문서 프로젝트**: 작성한 문서 저장/관리, 버전 히스토리 (최대 10), 프로젝트 검색+타입 필터
- **다국어**: 한국어, English, 日本語 (710+ i18n keys)

### 보안 & 프라이버시
- API 키는 로컬 chrome.storage에만 저장
- 외부 서버로 데이터 전송 없음 (사용자의 API 키로 직접 통신)
- 대화 기록은 로컬에만 저장

## 스크린샷 요구사항

1280x800 또는 640x400 (최소 1개, 최대 5개)

### 스크린샷 목록 (v4.5 업데이트 필요)
1. **커스텀 비서** — 비서 선택 + 대화 화면
2. **문서 번역** — 파일 업로드 + 실시간 진행 상황 (ETA)
3. **템플릿 문서** — DOCX 템플릿 갤러리 + 필드 자동 생성
4. **이미지 생성** — DALL-E 3 프롬프트 + 생성된 이미지 갤러리
5. **딥 리서치** — 리서치 진행 중 + 출처 포함 리포트

## 프라이버시 정책 (Privacy Policy)

### 수집하는 데이터
- **없음**: H Chat은 사용자 데이터를 수집하거나 외부 서버로 전송하지 않습니다.

### 로컬 저장 데이터
- API 키 (chrome.storage.local)
- 대화 기록 (chrome.storage.local)
- 사용량 통계 (chrome.storage.local)
- 설정 (chrome.storage.local)

### 외부 통신
- 사용자가 설정한 AI API 엔드포인트로만 통신 (AWS Bedrock, OpenAI, Google Gemini)
- 웹 검색 기능 활성화 시 DuckDuckGo 또는 Google Custom Search API
- Webhook 알림 설정 시 사용자가 지정한 URL

### 권한 사용 목적
- `storage`: 설정, 대화 기록, 사용량 저장
- `sidePanel`: 사이드바 UI
- `contextMenus`: 우클릭 메뉴에서 AI 질문
- `activeTab`: 현재 탭의 텍스트 선택
- `scripting`: Writing Assistant, 검색 강화 콘텐츠 스크립트 주입
- `tabs`: 탭 정보 접근
- `<all_urls>`: AI API 엔드포인트 통신 및 콘텐츠 스크립트

## 배포 체크리스트

- [ ] manifest.json version 업데이트
- [ ] `npm run build` → dist/ 생성
- [ ] dist/ 를 ZIP으로 압축
- [ ] Chrome Web Store Developer Dashboard 접속
- [ ] 기본 정보 입력 (이름, 설명, 카테고리)
- [ ] 스크린샷 5장 업로드
- [ ] 프라이버시 정책 URL 입력
- [ ] ZIP 업로드
- [ ] 심사 제출
