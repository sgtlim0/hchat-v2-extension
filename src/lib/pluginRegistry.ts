// lib/pluginRegistry.ts — Custom plugin/tool registry for agent mode

import { Storage } from './storage'
import { getGlobalLocale } from '../i18n'
import type { Tool } from './agent'

const STORAGE_KEY = 'hchat:plugins'

export type PluginType = 'webhook' | 'javascript' | 'prompt'

export interface WebhookConfig {
  url: string
  method: 'GET' | 'POST'
  headers?: Record<string, string>
}

export interface JavaScriptConfig {
  code: string
}

export interface PromptConfig {
  template: string
}

export interface Plugin {
  id: string
  name: string
  description: string
  enabled: boolean
  type: PluginType
  config: WebhookConfig | JavaScriptConfig | PromptConfig
}

function generateId(): string {
  return `plugin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function loadPlugins(): Promise<Plugin[]> {
  const data = await Storage.get<Plugin[]>(STORAGE_KEY)
  return data ?? []
}

async function savePlugins(plugins: Plugin[]): Promise<void> {
  await Storage.set(STORAGE_KEY, plugins)
}

function executeWebhook(cfg: WebhookConfig): (params: Record<string, unknown>) => Promise<string> {
  return async (params) => {
    try {
      const url = new URL(cfg.url)

      if (cfg.method === 'GET') {
        for (const [k, v] of Object.entries(params)) {
          url.searchParams.set(k, String(v))
        }
      }

      const fetchOpts: RequestInit = {
        method: cfg.method,
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.headers ?? {}),
        },
      }

      if (cfg.method === 'POST') {
        fetchOpts.body = JSON.stringify(params)
      }

      const res = await fetch(url.toString(), fetchOpts)
      if (!res.ok) {
        return `HTTP error: ${res.status} ${res.statusText}`
      }
      const text = await res.text()
      return text.slice(0, 4000)
    } catch (err) {
      return `Webhook error: ${String(err)}`
    }
  }
}

function executePromptTemplate(cfg: PromptConfig): (params: Record<string, unknown>) => Promise<string> {
  return async (params) => {
    const input = String(params.input ?? '')
    return cfg.template.replace(/\{\{input\}\}/g, input)
  }
}

function executeJavaScript(cfg: JavaScriptConfig): (params: Record<string, unknown>) => Promise<string> {
  return async (params) => {
    try {
      const input = String(params.input ?? '')
      // Simple template-based approach: replace {{input}} in code template
      const code = cfg.code.replace(/\{\{input\}\}/g, input)
      // Use a restricted evaluation via Function constructor with limited scope
      // Only allow basic string operations for safety
      const SAFE_PATTERN = /^[\w\s+\-*/().,"'`${}:;=<>!?\[\]|&%^~@#\\n\\t]+$/
      if (!SAFE_PATTERN.test(code)) {
        return 'Error: Code contains unsafe characters'
      }
      const result = new Function('input', `"use strict"; ${code}`)(input)
      return String(result ?? '')
    } catch (err) {
      return `JavaScript error: ${String(err)}`
    }
  }
}

function pluginToTool(plugin: Plugin): Tool {
  const isEn = getGlobalLocale() === 'en'

  if (plugin.type === 'webhook') {
    const cfg = plugin.config as WebhookConfig
    return {
      name: plugin.id,
      description: plugin.description,
      parameters: {
        input: {
          type: 'string',
          description: isEn ? 'Input data for the webhook' : 'Webhook에 전달할 입력 데이터',
          required: true,
        },
      },
      execute: executeWebhook(cfg),
    }
  }

  if (plugin.type === 'javascript') {
    const cfg = plugin.config as JavaScriptConfig
    return {
      name: plugin.id,
      description: plugin.description,
      parameters: {
        input: {
          type: 'string',
          description: isEn ? 'Input value for the script' : '스크립트에 전달할 입력값',
          required: true,
        },
      },
      execute: executeJavaScript(cfg),
    }
  }

  // prompt type
  const cfg = plugin.config as PromptConfig
  return {
    name: plugin.id,
    description: plugin.description,
    parameters: {
      input: {
        type: 'string',
        description: isEn ? 'Input text for the prompt template' : '프롬프트 템플릿에 전달할 텍스트',
        required: true,
      },
    },
    execute: executePromptTemplate(cfg),
  }
}

export const PluginRegistry = {
  async list(): Promise<Plugin[]> {
    return loadPlugins()
  },

  async get(id: string): Promise<Plugin | null> {
    const plugins = await loadPlugins()
    return plugins.find((p) => p.id === id) ?? null
  },

  async add(data: Omit<Plugin, 'id'>): Promise<Plugin> {
    const plugins = await loadPlugins()
    const plugin: Plugin = { ...data, id: generateId() }
    await savePlugins([...plugins, plugin])
    return plugin
  },

  async update(id: string, data: Partial<Omit<Plugin, 'id'>>): Promise<Plugin | null> {
    const plugins = await loadPlugins()
    const idx = plugins.findIndex((p) => p.id === id)
    if (idx === -1) return null

    const updated: Plugin = { ...plugins[idx], ...data, id }
    const next = plugins.map((p, i) => (i === idx ? updated : p))
    await savePlugins(next)
    return updated
  },

  async remove(id: string): Promise<boolean> {
    const plugins = await loadPlugins()
    const filtered = plugins.filter((p) => p.id !== id)
    if (filtered.length === plugins.length) return false
    await savePlugins(filtered)
    return true
  },

  async getEnabled(): Promise<Plugin[]> {
    const plugins = await loadPlugins()
    return plugins.filter((p) => p.enabled)
  },

  async toAgentTools(): Promise<Tool[]> {
    const enabled = await this.getEnabled()
    return enabled.map(pluginToTool)
  },
}
