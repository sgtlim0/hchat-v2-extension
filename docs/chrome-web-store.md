# Chrome Web Store 배포 가이드

## 기본 정보

- **이름**: H Chat — Multi-AI Sidebar Assistant
- **짧은 설명** (132자 이내): AWS Bedrock, OpenAI, Google Gemini를 하나의 사이드바에서. 다국어 AI 채팅, 딥 리서치, 데이터 분석, 프롬프트 라이브러리.
- **카테고리**: Productivity
- **언어**: 한국어, English, 日本語

## 상세 설명

H Chat은 Chrome 사이드바에서 여러 AI 모델을 동시에 사용할 수 있는 확장 프로그램입니다.

### 주요 기능
- **멀티 AI 지원**: AWS Bedrock (Claude), OpenAI (GPT), Google Gemini
- **스마트 라우팅**: 질문 유형에 따라 최적의 모델 자동 선택
- **딥 리서치**: 다단계 웹 검색 + AI 분석 리포트 생성
- **데이터 분석**: CSV/Excel 업로드 → 자동 차트 시각화 + AI 인사이트
- **그룹 채팅**: 여러 AI 모델에 동시 질문, 응답 비교
- **AI 토론**: 두 AI 모델 간 자동 토론 진행
- **프롬프트 라이브러리**: 즐겨찾는 프롬프트 저장, 카테고리 분류, 가져오기/내보내기
- **Writing Assistant**: 웹페이지 텍스트 선택 → 교정/요약/번역/톤변환
- **검색 강화**: Google/Bing/Naver 검색 결과에 AI 요약 카드
- **사용량 관리**: 비용 추적, 월간 예산, Webhook 알림
- **다국어**: 한국어, English, 日本語

### 보안 & 프라이버시
- API 키는 로컬 chrome.storage에만 저장
- 외부 서버로 데이터 전송 없음 (사용자의 API 키로 직접 통신)
- 대화 기록은 로컬에만 저장

## 스크린샷 요구사항

1280x800 또는 640x400 (최소 1개, 최대 5개)

### 스크린샷 목록
1. **메인 채팅** — 사이드바에서 AI와 대화하는 모습
2. **딥 리서치** — 리서치 진행 중 + 리포트 결과
3. **데이터 분석** — CSV 업로드 + 차트 시각화
4. **그룹 채팅** — 여러 AI 응답 비교
5. **설정** — API 키 설정 + 테마 선택

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
