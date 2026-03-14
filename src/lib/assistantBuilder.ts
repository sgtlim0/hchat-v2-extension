// lib/assistantBuilder.ts — Custom assistant (system prompt + model + tools + parameters) management

import { Storage } from './storage'
import { t } from '../i18n'
import { SK } from './storageKeys'

export interface AssistantParameters {
  temperature?: number
  maxTokens?: number
  thinkingDepth?: 'fast' | 'normal' | 'deep'
}

export type AssistantCategory = 'translate' | 'document' | 'analysis' | 'code' | 'writing' | 'other'

export interface CustomAssistant {
  id: string
  name: string
  description: string
  icon: string
  systemPrompt: string
  model: string
  tools: string[]
  parameters: AssistantParameters
  category: AssistantCategory
  isBuiltIn: boolean
  usageCount: number
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = SK.ASSISTANTS
const ACTIVE_ASSISTANT_KEY = SK.ACTIVE_ASSISTANT

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
      category: 'document',
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
      category: 'translate',
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
      category: 'analysis',
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
      category: 'writing',
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
      category: 'code',
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
      category: 'document',
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
      category: 'document',
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
      category: 'analysis',
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    // New built-in assistants (12 more)
    {
      id: 'ast-tech-writer',
      name: t('assistant.builtins.techWriter.name'),
      description: t('assistant.builtins.techWriter.desc'),
      icon: '\u{1F4DD}',
      systemPrompt: '당신은 기술 문서 작성 전문가입니다. API 문서, 사용자 가이드, 기술 명세서 등을 작성합니다. 기술적 정확성과 명확성을 중시하며, 독자의 기술 수준을 고려하여 적절한 설명을 제공합니다.',
      model: 'us.anthropic.claude-sonnet-4-6',
      tools: ['web_search'],
      parameters: {},
      category: 'document',
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-marketing-copy',
      name: t('assistant.builtins.marketingCopy.name'),
      description: t('assistant.builtins.marketingCopy.desc'),
      icon: '\u{1F4E2}',
      systemPrompt: '당신은 마케팅 카피라이터입니다. 제품 설명, 광고 문구, SNS 콘텐츠 등을 작성합니다. 타겟 고객을 고려하고, 설득력 있고 매력적인 메시지를 전달합니다. CTA(Call to Action)를 효과적으로 활용하세요.',
      model: 'gpt-4o',
      tools: [],
      parameters: {},
      category: 'writing',
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-legal-review',
      name: t('assistant.builtins.legalReview.name'),
      description: t('assistant.builtins.legalReview.desc'),
      icon: '\u{2696}\u{FE0F}',
      systemPrompt: '당신은 법률 문서 검토 전문가입니다. 계약서, 이용약관, 개인정보 처리방침 등을 검토합니다. 법률적 리스크를 식별하고, 개선점을 제안합니다. 주의: 법률 자문이 아닌 참고 정보만 제공합니다.',
      model: 'us.anthropic.claude-opus-4-6-v1',
      tools: ['web_search'],
      parameters: {},
      category: 'document',
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-api-doc',
      name: t('assistant.builtins.apiDoc.name'),
      description: t('assistant.builtins.apiDoc.desc'),
      icon: '\u{1F50C}',
      systemPrompt: '당신은 API 문서 생성 전문가입니다. RESTful API, GraphQL, gRPC 등의 API 문서를 작성합니다. 엔드포인트, 파라미터, 응답 형식, 에러 코드 등을 명확하게 문서화합니다. OpenAPI 명세를 준수하세요.',
      model: 'us.anthropic.claude-sonnet-4-6',
      tools: ['fetch_url'],
      parameters: {},
      category: 'code',
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-sql-helper',
      name: t('assistant.builtins.sqlHelper.name'),
      description: t('assistant.builtins.sqlHelper.desc'),
      icon: '\u{1F5C3}\u{FE0F}',
      systemPrompt: '당신은 SQL 쿼리 전문가입니다. 데이터베이스 설계, SQL 쿼리 작성, 최적화를 지원합니다. MySQL, PostgreSQL, SQL Server 등 다양한 DBMS에 대응하며, 성능과 보안을 고려한 쿼리를 제안합니다.',
      model: 'gpt-4o',
      tools: [],
      parameters: {},
      category: 'code',
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-frontend',
      name: t('assistant.builtins.frontend.name'),
      description: t('assistant.builtins.frontend.desc'),
      icon: '\u{1F3A8}',
      systemPrompt: '당신은 프론트엔드 개발 전문가입니다. React, Vue, Angular 등의 프레임워크와 HTML/CSS/JavaScript를 다룹니다. UI/UX 원칙을 준수하고, 접근성과 성능을 고려한 코드를 작성합니다. Tailwind CSS를 선호합니다.',
      model: 'us.anthropic.claude-sonnet-4-6',
      tools: ['fetch_url'],
      parameters: {},
      category: 'code',
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-market-analysis',
      name: t('assistant.builtins.marketAnalysis.name'),
      description: t('assistant.builtins.marketAnalysis.desc'),
      icon: '\u{1F4C8}',
      systemPrompt: '당신은 시장 분석 전문가입니다. 산업 동향, 경쟁사 분석, 시장 기회를 파악합니다. 데이터 기반의 인사이트를 제공하고, SWOT 분석 등 프레임워크를 활용합니다.',
      model: 'us.anthropic.claude-sonnet-4-6',
      tools: ['web_search'],
      parameters: {},
      category: 'analysis',
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-financial-analysis',
      name: t('assistant.builtins.financialAnalysis.name'),
      description: t('assistant.builtins.financialAnalysis.desc'),
      icon: '\u{1F4B0}',
      systemPrompt: '당신은 재무 분석 전문가입니다. 재무제표 분석, 투자 평가, 비용 분석 등을 수행합니다. ROI, NPV, IRR 등 재무 지표를 활용하고, 리스크를 고려한 의사결정을 지원합니다.',
      model: 'gpt-4o',
      tools: ['calculate', 'web_search'],
      parameters: {},
      category: 'analysis',
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-japanese-translator',
      name: t('assistant.builtins.japaneseTranslator.name'),
      description: t('assistant.builtins.japaneseTranslator.desc'),
      icon: '\u{1F1EF}\u{1F1F5}',
      systemPrompt: '당신은 일본어 번역 전문가입니다. 한국어↔일본어 번역을 정확하고 자연스럽게 수행합니다. 경어 체계와 문화적 뉘앙스를 고려하며, 비즈니스 문서부터 일상 대화까지 다양한 상황에 대응합니다.',
      model: 'gemini-2.0-flash',
      tools: ['translate'],
      parameters: {},
      category: 'translate',
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-chinese-translator',
      name: t('assistant.builtins.chineseTranslator.name'),
      description: t('assistant.builtins.chineseTranslator.desc'),
      icon: '\u{1F1E8}\u{1F1F3}',
      systemPrompt: '당신은 중국어 번역 전문가입니다. 한국어↔중국어(간체) 번역을 전문으로 합니다. 중국 문화와 관용구를 이해하고, 비즈니스 및 기술 분야의 전문 용어를 정확하게 번역합니다.',
      model: 'gpt-4o',
      tools: ['translate'],
      parameters: {},
      category: 'translate',
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-academic-summary',
      name: t('assistant.builtins.academicSummary.name'),
      description: t('assistant.builtins.academicSummary.desc'),
      icon: '\u{1F393}',
      systemPrompt: '당신은 학술 논문 요약 전문가입니다. 연구 논문의 핵심 내용을 파악하고, 연구 방법론, 주요 발견, 결론을 명확하게 요약합니다. 학술적 엄밀성을 유지하면서도 이해하기 쉽게 설명합니다.',
      model: 'us.anthropic.claude-opus-4-6-v1',
      tools: ['web_search', 'fetch_url'],
      parameters: {},
      category: 'analysis',
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'ast-presentation-planner',
      name: t('assistant.builtins.presentationPlanner.name'),
      description: t('assistant.builtins.presentationPlanner.desc'),
      icon: '\u{1F3AF}',
      systemPrompt: '당신은 프레젠테이션 기획 전문가입니다. 발표 구성, 슬라이드 컨셉, 스토리텔링을 지원합니다. 청중 분석을 통해 효과적인 메시지 전달 방법을 제안하고, 시각적 요소 활용을 권장합니다.',
      model: 'us.anthropic.claude-sonnet-4-6',
      tools: ['web_search'],
      parameters: {},
      category: 'document',
      isBuiltIn: true,
      usageCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
  ]
}

type AddData = Omit<
  CustomAssistant,
  'id' | 'isBuiltIn' | 'usageCount' | 'createdAt' | 'updatedAt'
>

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

  async update(
    id: string,
    patch: Partial<
      Pick<
        CustomAssistant,
        'name' | 'description' | 'icon' | 'systemPrompt' | 'model' | 'tools' | 'parameters' | 'category'
      >
    >,
  ): Promise<void> {
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

  async getByCategory(category: AssistantCategory | 'all'): Promise<CustomAssistant[]> {
    const all = await this.list()
    if (category === 'all') return all
    return all.filter((a) => a.category === category)
  },

  async searchAssistants(query: string): Promise<CustomAssistant[]> {
    const all = await this.list()
    if (!query.trim()) return all
    const lowerQuery = query.toLowerCase()
    return all.filter(
      (a) =>
        a.name.toLowerCase().includes(lowerQuery) ||
        a.description.toLowerCase().includes(lowerQuery),
    )
  },

  async exportAssistants(ids?: string[]): Promise<string> {
    const custom = await this.getCustom()
    const toExport = ids ? custom.filter((a) => ids.includes(a.id)) : custom

    const exportData = {
      version: 1,
      exportedAt: Date.now(),
      assistants: toExport,
    }

    return JSON.stringify(exportData, null, 2)
  },

  async importAssistants(json: string): Promise<{ imported: number; skipped: number }> {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      throw new Error('Invalid JSON format')
    }

    // Validate structure
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      !('assistants' in parsed) ||
      !Array.isArray((parsed as { assistants: unknown }).assistants)
    ) {
      throw new Error('Invalid assistant export format')
    }

    const data = parsed as { version: number; assistants: CustomAssistant[] }
    const existingCustom = await this.getCustom()
    const existingNames = new Set(existingCustom.map((a) => a.name))

    let imported = 0
    let skipped = 0

    for (const assistant of data.assistants) {
      // Skip duplicates by name
      if (existingNames.has(assistant.name)) {
        skipped++
        continue
      }

      // Generate new ID and reset usage count
      const newAssistant: CustomAssistant = {
        ...assistant,
        id: crypto.randomUUID(),
        isBuiltIn: false,
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      existingCustom.push(newAssistant)
      imported++
    }

    await Storage.set(STORAGE_KEY, existingCustom)
    return { imported, skipped }
  },
}
