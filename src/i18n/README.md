# src/i18n/

## 개요

경량 자체 구현 국제화 시스템. 3개 언어 (한국어/영어/일본어), 1,022개 키. 외부 라이브러리 미사용.

## 파일 목록

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `index.ts` | ~80 | t(), useLocale(), tSync(), getLocale() 함수 |
| `ko.ts` | 1,022 | 한국어 번역 (기본 언어) |
| `en.ts` | 1,022 | 영어 번역 |
| `ja.ts` | 1,021 | 일본어 번역 |

## API

### React 컴포넌트용
```typescript
import { t, useLocale } from '../i18n'

function MyComponent() {
  const locale = useLocale()  // 'ko' | 'en' | 'ja'
  return <p>{t('chat.send')}</p>
}
```

### Content Script용 (비동기)
```typescript
import { tSync, getLocale } from '../i18n'

// Content Script에서는 chrome.storage에서 로케일을 비동기 로드
const locale = await getLocale()
const label = tSync('toolbar.explain', locale)
```

## 키 구조 (1,022 keys)

| 네임스페이스 | 키 수 | 설명 |
|-------------|-------|------|
| `common.*` | ~30 | 공통 (확인, 취소, 삭제 등) |
| `chat.*` | ~50 | 채팅 UI |
| `group.*` | ~15 | 그룹 채팅 |
| `debate.*` | ~25 | 토론 + 투표 |
| `tools.*` | ~80 | 17개 AI 도구 |
| `settings.*` | ~40 | 설정 |
| `prompts.*` | ~20 | 프롬프트 라이브러리 |
| `history.*` | ~15 | 대화 기록 |
| `bookmarks.*` | ~15 | 북마크 |
| `usage.*` | ~20 | 사용량 |
| `assistant.*` | ~30 | 비서 마켓플레이스 |
| `guardrail.*` | ~10 | PII 가드레일 |
| `template.*` | ~15 | 대화 템플릿 |
| `shortcuts.*` | ~10 | 키보드 단축키 |
| `chain.*` | ~12 | 비서 체인 |
| `voice.*` | ~10 | 음성 대화 |
| `analytics.*` | ~10 | 대화 분석 |
| `memory.*` | ~12 | AI 메모리 |
| `style.*` | ~9 | 응답 스타일 |
| `tree.*` | ~8 | 대화 트리 |
| `workflow.*` | ~12 | 워크플로우 |
| `mcp.*` | ~8 | MCP 서버 |
| `sharing.*` | ~10 | 팀 공유 |
| 기타 | ~500+ | 도구별 상세, 모델 레이블, 에러 메시지 등 |

## 키 추가 시 주의사항

1. **3개 파일 모두 동일 키** 추가 필수 (ko.ts, en.ts, ja.ts)
2. 키 이름은 `namespace.key` dot notation
3. 중첩 객체 지원 (`modelLabels.sonnet` 등)
4. Content Script는 `tSync()` 사용 (동기 번역)
