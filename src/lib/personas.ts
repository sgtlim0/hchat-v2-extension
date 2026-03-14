// lib/personas.ts — Custom persona (system prompt) management

import { Storage } from './storage'
import { t } from '../i18n'
import { SK } from './storageKeys'

export interface Persona {
  id: string
  name: string
  icon: string
  systemPrompt: string
  description: string
  builtin: boolean
  createdAt: number
}

const PERSONAS_KEY = SK.PERSONAS
const ACTIVE_PERSONA_KEY = SK.ACTIVE_PERSONA

/**
 * Returns the built-in personas with localized names and descriptions.
 */
export function getBuiltinPersonas(): Persona[] {
  return [
    {
      id: 'default',
      name: t('persona.builtins.default.name'),
      icon: '🤖',
      systemPrompt: '당신은 도움이 되는 AI 어시스턴트입니다. 한국어로 답변해주세요.',
      description: t('persona.builtins.default.desc'),
      builtin: true,
      createdAt: 0,
    },
    {
      id: 'developer',
      name: t('persona.builtins.developer.name'),
      icon: '💻',
      systemPrompt: '당신은 시니어 소프트웨어 개발자입니다. 코드 리뷰, 디버깅, 아키텍처 설계를 전문으로 합니다. 코드를 작성할 때는 항상 TypeScript를 사용하고, 클린 코드 원칙을 따르세요. 한국어로 답변하되, 코드와 기술 용어는 영어를 사용하세요.',
      description: t('persona.builtins.developer.desc'),
      builtin: true,
      createdAt: 0,
    },
    {
      id: 'writer',
      name: t('persona.builtins.writer.name'),
      icon: '✍️',
      systemPrompt: '당신은 전문 작문 코치입니다. 사용자의 글을 분석하고, 구조, 문체, 표현력을 개선하는 구체적인 피드백을 제공합니다. 비즈니스 이메일, 보고서, 블로그, 에세이 등 다양한 형식에 전문적인 조언을 합니다. 한국어 문법과 맞춤법에 특히 주의를 기울이세요.',
      description: t('persona.builtins.writer.desc'),
      builtin: true,
      createdAt: 0,
    },
    {
      id: 'translator',
      name: t('persona.builtins.translator.name'),
      icon: '🌐',
      systemPrompt: '당신은 전문 통역사입니다. 영어↔한국어 번역을 전문으로 하며, 문맥과 뉘앙스를 정확하게 전달합니다. 번역 시 원문의 톤과 스타일을 최대한 보존하세요. 전문 용어가 있으면 괄호 안에 원어를 병기하세요.',
      description: t('persona.builtins.translator.desc'),
      builtin: true,
      createdAt: 0,
    },
    {
      id: 'analyst',
      name: t('persona.builtins.analyst.name'),
      icon: '📊',
      systemPrompt: '당신은 데이터 분석 전문가입니다. 데이터를 구조적으로 분석하고, 인사이트를 도출하며, 명확한 시각화 제안을 합니다. 통계적 근거를 바탕으로 결론을 내리고, 불확실한 부분은 명시하세요. 답변은 한국어로, 수식과 코드는 영어로 작성하세요.',
      description: t('persona.builtins.analyst.desc'),
      builtin: true,
      createdAt: 0,
    },
    {
      id: 'teacher',
      name: t('persona.builtins.teacher.name'),
      icon: '📚',
      systemPrompt: '당신은 친절한 개인 튜터입니다. 복잡한 개념을 쉽게 설명하고, 단계별로 가르칩니다. 비유와 예시를 적극 활용하세요. 학생이 이해했는지 확인하는 질문을 하고, 추가 학습 자료를 제안하세요. 한국어로 답변하세요.',
      description: t('persona.builtins.teacher.desc'),
      builtin: true,
      createdAt: 0,
    },
  ]
}

export const Personas = {
  async list(): Promise<Persona[]> {
    const custom = (await Storage.get<Persona[]>(PERSONAS_KEY)) ?? []
    return [...getBuiltinPersonas(), ...custom]
  },

  async getCustom(): Promise<Persona[]> {
    return (await Storage.get<Persona[]>(PERSONAS_KEY)) ?? []
  },

  async add(persona: Omit<Persona, 'id' | 'builtin' | 'createdAt'>): Promise<Persona> {
    const custom = await this.getCustom()
    const p: Persona = {
      ...persona,
      id: crypto.randomUUID(),
      builtin: false,
      createdAt: Date.now(),
    }
    custom.push(p)
    await Storage.set(PERSONAS_KEY, custom)
    return p
  },

  async update(id: string, patch: Partial<Pick<Persona, 'name' | 'icon' | 'systemPrompt' | 'description'>>): Promise<void> {
    const custom = await this.getCustom()
    const idx = custom.findIndex((p) => p.id === id)
    if (idx === -1) return
    custom[idx] = { ...custom[idx], ...patch }
    await Storage.set(PERSONAS_KEY, custom)
  },

  async remove(id: string): Promise<void> {
    const custom = await this.getCustom()
    await Storage.set(PERSONAS_KEY, custom.filter((p) => p.id !== id))
  },

  async getActive(): Promise<string> {
    return (await Storage.get<string>(ACTIVE_PERSONA_KEY)) ?? 'default'
  },

  async setActive(id: string): Promise<void> {
    await Storage.set(ACTIVE_PERSONA_KEY, id)
  },

  async getById(id: string): Promise<Persona | undefined> {
    const all = await this.list()
    return all.find((p) => p.id === id)
  },
}
