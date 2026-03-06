import { Storage } from './storage'

const STORAGE_KEY = 'hchat:mcp-servers'
const MAX_SERVERS = 10

export interface McpServerConfig {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  enabled: boolean
  createdAt: number
}

export interface McpTool {
  name: string
  description: string
  parameters: Record<string, { type: string; description: string; required?: boolean }>
}

export interface McpToolResult {
  success: boolean
  output: string
  error?: string
}

export interface McpResource {
  uri: string
  name: string
  mimeType: string
}

// --- Storage helpers ---

export async function getServers(): Promise<McpServerConfig[]> {
  const servers = await Storage.get<McpServerConfig[]>(STORAGE_KEY)
  return servers ?? []
}

async function saveServers(servers: McpServerConfig[]): Promise<void> {
  await Storage.set(STORAGE_KEY, servers)
}

// --- Server registration ---

export async function registerServer(config: McpServerConfig): Promise<void> {
  const servers = await getServers()
  const existingIndex = servers.findIndex((s) => s.id === config.id)

  if (existingIndex >= 0) {
    const updated = servers.map((s) => (s.id === config.id ? config : s))
    await saveServers(updated)
    return
  }

  if (servers.length >= MAX_SERVERS) {
    throw new Error('Maximum 10 MCP servers allowed')
  }

  await saveServers([...servers, config])
}

export async function removeServer(id: string): Promise<void> {
  const servers = await getServers()
  const filtered = servers.filter((s) => s.id !== id)
  await saveServers(filtered)
}

// --- Internal helpers ---

async function resolveServer(serverId: string): Promise<McpServerConfig> {
  const servers = await getServers()
  const server = servers.find((s) => s.id === serverId)

  if (!server) {
    throw new Error(`Server not found: ${serverId}`)
  }

  if (!server.enabled) {
    throw new Error(`Server is disabled: ${serverId}`)
  }

  return server
}

function buildHeaders(server: McpServerConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (server.apiKey) {
    headers.Authorization = `Bearer ${server.apiKey}`
  }

  return headers
}

// --- Tool discovery & execution ---

export async function listTools(serverId: string): Promise<McpTool[]> {
  const server = await resolveServer(serverId)
  const headers = buildHeaders(server)

  const response = await fetch(`${server.baseUrl}/tools`, {
    method: 'GET',
    headers,
  })

  const data = await response.json()
  return data.tools ?? []
}

export async function executeTool(
  serverId: string,
  toolName: string,
  params: Record<string, unknown>,
): Promise<McpToolResult> {
  const server = await resolveServer(serverId)
  const headers = buildHeaders(server)

  try {
    const response = await fetch(`${server.baseUrl}/tools/${toolName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      return {
        success: false,
        output: '',
        error: `HTTP ${response.status} ${response.statusText}`,
      }
    }

    const data = await response.json()
    return data as McpToolResult
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// --- Resource access ---

export async function listResources(serverId: string): Promise<McpResource[]> {
  const server = await resolveServer(serverId)
  const headers = buildHeaders(server)

  const response = await fetch(`${server.baseUrl}/resources`, {
    method: 'GET',
    headers,
  })

  const data = await response.json()
  return data.resources ?? []
}

export async function getResource(serverId: string, uri: string): Promise<string> {
  const server = await resolveServer(serverId)
  const headers = buildHeaders(server)
  const encodedUri = encodeURIComponent(uri)

  const response = await fetch(`${server.baseUrl}/resources?uri=${encodedUri}`, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`)
  }

  return response.text()
}

// --- Connection test ---

export async function testConnection(config: McpServerConfig): Promise<boolean> {
  try {
    const headers = buildHeaders(config)
    const response = await fetch(`${config.baseUrl}/health`, {
      method: 'GET',
      headers,
    })
    return response.ok
  } catch {
    return false
  }
}
