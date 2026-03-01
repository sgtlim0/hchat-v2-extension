export type WritingAction =
  | 'paraphrase'
  | 'formal'
  | 'casual'
  | 'shorter'
  | 'longer'
  | 'grammar'
  | 'translate_ko'
  | 'translate_en'
  | 'bullets'
  | 'outline'
  | 'explain'

export const WRITING_ACTIONS: { id: WritingAction; label: string; emoji: string; prompt: string }[] = [
  { id: 'paraphrase', label: '문장 바꾸기', emoji: '🔄', prompt: '다음 문장을 의미는 유지하면서 다르게 표현해줘 (한국어로):' },
  { id: 'formal', label: '격식체로', emoji: '🎩', prompt: '다음을 격식 있는 문체로 바꿔줘:' },
  { id: 'casual', label: '친근하게', emoji: '😊', prompt: '다음을 친근하고 자연스러운 말투로 바꿔줘:' },
  { id: 'shorter', label: '짧게', emoji: '✂️', prompt: '다음을 핵심만 남기고 간결하게 줄여줘:' },
  { id: 'longer', label: '길게', emoji: '📝', prompt: '다음을 더 풍부하고 상세하게 확장해줘:' },
  { id: 'grammar', label: '문법 교정', emoji: '✅', prompt: '다음의 맞춤법, 문법, 어색한 표현을 교정해줘:' },
  { id: 'translate_ko', label: '한국어로', emoji: '🇰🇷', prompt: '다음을 자연스러운 한국어로 번역해줘:' },
  { id: 'translate_en', label: '영어로', emoji: '🇺🇸', prompt: '다음을 자연스러운 영어로 번역해줘:' },
  { id: 'bullets', label: '목록으로', emoji: '📋', prompt: '다음을 글머리 기호 목록으로 정리해줘:' },
  { id: 'outline', label: '개요 작성', emoji: '🗂️', prompt: '다음 내용의 구조화된 개요를 작성해줘:' },
  { id: 'explain', label: '쉽게 설명', emoji: '💡', prompt: '다음을 누구나 이해하기 쉽게 설명해줘:' },
]

export function buildWritingPrompt(action: WritingAction, text: string): string {
  const def = WRITING_ACTIONS.find((a) => a.id === action)
  if (!def) return text
  return `${def.prompt}\n\n${text}`
}
