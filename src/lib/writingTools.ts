import { getGlobalLocale } from '../i18n'

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

export const WRITING_ACTIONS: { id: WritingAction; labelKey: string; emoji: string }[] = [
  { id: 'paraphrase', labelKey: 'writing.paraphrase', emoji: '🔄' },
  { id: 'formal', labelKey: 'writing.formal', emoji: '🎩' },
  { id: 'casual', labelKey: 'writing.casual', emoji: '😊' },
  { id: 'shorter', labelKey: 'writing.shorter', emoji: '✂️' },
  { id: 'longer', labelKey: 'writing.longer', emoji: '📝' },
  { id: 'grammar', labelKey: 'writing.grammar', emoji: '✅' },
  { id: 'translate_ko', labelKey: 'writing.translateKo', emoji: '🇰🇷' },
  { id: 'translate_en', labelKey: 'writing.translateEn', emoji: '🇺🇸' },
  { id: 'bullets', labelKey: 'writing.bullets', emoji: '📋' },
  { id: 'outline', labelKey: 'writing.outline', emoji: '🗂️' },
  { id: 'explain', labelKey: 'writing.explain', emoji: '💡' },
]

const PROMPTS_KO: Record<WritingAction, string> = {
  paraphrase: '다음 문장을 의미는 유지하면서 다르게 표현해줘 (한국어로):',
  formal: '다음을 격식 있는 문체로 바꿔줘:',
  casual: '다음을 친근하고 자연스러운 말투로 바꿔줘:',
  shorter: '다음을 핵심만 남기고 간결하게 줄여줘:',
  longer: '다음을 더 풍부하고 상세하게 확장해줘:',
  grammar: '다음의 맞춤법, 문법, 어색한 표현을 교정해줘:',
  translate_ko: '다음을 자연스러운 한국어로 번역해줘:',
  translate_en: '다음을 자연스러운 영어로 번역해줘:',
  bullets: '다음을 글머리 기호 목록으로 정리해줘:',
  outline: '다음 내용의 구조화된 개요를 작성해줘:',
  explain: '다음을 누구나 이해하기 쉽게 설명해줘:',
}

const PROMPTS_EN: Record<WritingAction, string> = {
  paraphrase: 'Rephrase the following while keeping the same meaning:',
  formal: 'Rewrite the following in a formal tone:',
  casual: 'Rewrite the following in a casual, friendly tone:',
  shorter: 'Shorten the following to just the key points:',
  longer: 'Expand the following with more detail and depth:',
  grammar: 'Check and correct spelling, grammar, and awkward expressions:',
  translate_ko: 'Translate the following into natural Korean:',
  translate_en: 'Translate the following into natural English:',
  bullets: 'Organize the following into a bullet-point list:',
  outline: 'Create a structured outline of the following content:',
  explain: 'Explain the following in simple terms anyone can understand:',
}

export function buildWritingPrompt(action: WritingAction, text: string): string {
  const prompts = getGlobalLocale() === 'en' ? PROMPTS_EN : PROMPTS_KO
  const prompt = prompts[action]
  if (!prompt) return text
  return `${prompt}\n\n${text}`
}
