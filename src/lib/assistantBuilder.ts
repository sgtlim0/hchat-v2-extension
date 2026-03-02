// lib/assistantBuilder.ts — Custom assistant (system prompt + model + tools + parameters) management

import { Storage } from './storage'
import { t } from '../i18n'

export interface AssistantParameters {
  temperature?: number
  maxTokens?: number
  thinkingDepth?: 'fast' | 'normal' | 'deep'
}

export interface CustomAssistant {
  id: string
  name: string
  description: string
  icon: string
  systemPrompt: string
  model: string
  tools: string[]
  parameters: AssistantParameters
  category: string
  isBuiltIn: boolean
  usageCount: number
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'hchat:assistants'
const ACTIVE_ASSISTANT_KEY = 'hchat:active-assistant'

/**
 * Returns the built-in assistants with localized names and descriptions.
 */
export function getBuiltinAssistants(): CustomAssistant[] {
  return [
    {
      id: 'ast-default',
      name: t('assistant.builtins.docReviewer.name'),
      description: t('assistant.builtins.docReviewer.desc'),
      icon: '\u{1F4DD}',
      systemPrompt: '당신은 문서 검토 전문가입니다. 문서의 구조, 논리적 흐름, 표현의 명확성을 분석하고, 구체적인 개선점을 제안합니다. 한국어 맞춤법과 문법에 특히 주의를 기울이세요.',
      model: 'us.anthropic.claude-sonnet-4-6',
      tools: ['read_page', 'summarize_text'],
      parameters: {},
      category: t('assistant.categoryDoc'),
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-translator',
      name: t('assistant.builtins.translator.name'),
      description: t('assistant.builtins.translator.desc'),
      icon: '\u{1F310}',
      systemPrompt: '당신은 전문 통역사입니다. 영어↔한국어 번역을 전문으로 하며, 문맥과 뉘앙스를 정확하게 전달합니다. 번역 시 원문의 톤과 스타일을 최대한 보존하세요. 전문 용어가 있으면 괄호 안에 원어를 병기하세요.',
      model: '',
      tools: ['translate'],
      parameters: {},
      category: t('assistant.categoryTranslation'),
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-data-analyst',
      name: t('assistant.builtins.dataAnalyst.name'),
      description: t('assistant.builtins.dataAnalyst.desc'),
      icon: '\u{1F4CA}',
      systemPrompt: '당신은 데이터 분석 전문가입니다. 데이터를 구조적으로 분석하고, 인사이트를 도출하며, 명확한 시각화 제안을 합니다. 통계적 근거를 바탕으로 결론을 내리고, 불확실한 부분은 명시하세요.',
      model: 'us.anthropic.claude-sonnet-4-6',
      tools: ['calculate', 'web_search'],
      parameters: {},
      category: t('assistant.categoryAnalysis'),
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-email-writer',
      name: t('assistant.builtins.emailWriter.name'),
      description: t('assistant.builtins.emailWriter.desc'),
      icon: '\u{2709}\u{FE0F}',
      systemPrompt: '당신은 비즈니스 이메일 작성 전문가입니다. 상황에 맞는 적절한 톤과 격식을 사용하여 명확하고 간결한 이메일을 작성합니다. 수신자와의 관계, 목적, 긴급도를 고려하여 최적의 이메일을 제안하세요.',
      model: '',
      tools: [],
      parameters: {},
      category: t('assistant.categoryWriting'),
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-code-reviewer',
      name: t('assistant.builtins.codeReviewer.name'),
      description: t('assistant.builtins.codeReviewer.desc'),
      icon: '\u{1F4BB}',
      systemPrompt: '당신은 시니어 소프트웨어 개발자입니다. 코드 리뷰, 디버깅, 아키텍처 설계를 전문으로 합니다. 코드를 작성할 때는 항상 TypeScript를 사용하고, 클린 코드 원칙을 따르세요. 한국어로 답변하되, 코드와 기술 용어는 영어를 사용하세요.',
      model: 'us.anthropic.claude-sonnet-4-6',
      tools: ['fetch_url'],
      parameters: {},
      category: t('assistant.categoryCode'),
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-report-writer',
      name: t('assistant.builtins.reportWriter.name'),
      description: t('assistant.builtins.reportWriter.desc'),
      icon: '\u{1F4CB}',
      systemPrompt: '당신은 보고서 작성 전문가입니다. 주어진 주제나 데이터를 바탕으로 구조화된 보고서를 작성합니다. 서론, 본론, 결론의 명확한 구조를 유지하고, 도표와 그래프를 제안합니다.',
      model: 'us.anthropic.claude-sonnet-4-6',
      tools: ['web_search'],
      parameters: {},
      category: t('assistant.categoryWriting'),
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-meeting-note',
      name: t('assistant.builtins.meetingNote.name'),
      description: t('assistant.builtins.meetingNote.desc'),
      icon: '\u{1F3AF}',
      systemPrompt: '당신은 회의록 정리 전문가입니다. 회의 내용을 구조적으로 정리하고, 주요 논의사항, 결정사항, 액션 아이템을 명확하게 분류합니다. 참석자별 발언 요약과 후속 조치 사항을 포함하세요.',
      model: '',
      tools: ['summarize_text'],
      parameters: {},
      category: t('assistant.categoryDoc'),
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-researcher',
      name: t('assistant.builtins.researcher.name'),
      description: t('assistant.builtins.researcher.desc'),
      icon: '\u{1F50D}',
      systemPrompt: '당신은 리서치 전문가입니다. 주어진 주제에 대해 심층적으로 조사하고, 다양한 출처의 정보를 종합하여 분석합니다. 정보의 신뢰성을 평가하고, 출처를 명확히 밝히세요.',
      model: 'us.anthropic.claude-sonnet-4-6',
      tools: ['web_search', 'fetch_url'],
      parameters: {},
      category: t('assistant.categoryAnalysis'),
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
  ]
}

type AddData = Omit<CustomAssistant, 'id' | 'isBuiltIn' | 'usageCount' | 'createdAt' | 'updatedAt'>

export const AssistantRegistry = {
  async list(): Promise<CustomAssistant[]> {
    const custom = (await Storage.get<CustomAssistant[]>(STORAGE_KEY)) ?? []
    return [...getBuiltinAssistants(), ...custom]
  },

  async getCustom(): Promise<CustomAssistant[]> {
    return (await Storage.get<CustomAssistant[]>(STORAGE_KEY)) ?? []
  },

  async add(data: AddData): Promise<CustomAssistant> {
    const custom = await this.getCustom()
    const now = Date.now()
    const assistant: CustomAssistant = {
      ...data,
      id: crypto.randomUUID(),
      isBuiltIn: false,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    await Storage.set(STORAGE_KEY, [...custom, assistant])
    return assistant
  },

  async update(id: string, patch: Partial<Pick<CustomAssistant, 'name' | 'description' | 'icon' | 'systemPrompt' | 'model' | 'tools' | 'parameters' | 'category'>>): Promise<void> {
    const custom = await this.getCustom()
    const idx = custom.findIndex((a) => a.id === id)
    if (idx === -1) return
    const updated = custom.map((a, i) =>
      i === idx ? { ...a, ...patch, updatedAt: Date.now() } : a,
    )
    await Storage.set(STORAGE_KEY, updated)
  },

  async remove(id: string): Promise<void> {
    const builtins = getBuiltinAssistants()
    if (builtins.some((b) => b.id === id)) return
    const custom = await this.getCustom()
    await Storage.set(STORAGE_KEY, custom.filter((a) => a.id !== id))
  },

  async getActive(): Promise<string> {
    return (await Storage.get<string>(ACTIVE_ASSISTANT_KEY)) ?? 'ast-default'
  },

  async setActive(id: string): Promise<void> {
    await Storage.set(ACTIVE_ASSISTANT_KEY, id)
  },

  async getById(id: string): Promise<CustomAssistant | undefined> {
    const all = await this.list()
    return all.find((a) => a.id === id)
  },

  async incrementUsage(id: string): Promise<void> {
    const builtins = getBuiltinAssistants()
    if (builtins.some((b) => b.id === id)) return

    const custom = await this.getCustom()
    const idx = custom.findIndex((a) => a.id === id)
    if (idx === -1) return
    const updated = custom.map((a, i) =>
      i === idx ? { ...a, usageCount: a.usageCount + 1 } : a,
    )
    await Storage.set(STORAGE_KEY, updated)
  },
}
