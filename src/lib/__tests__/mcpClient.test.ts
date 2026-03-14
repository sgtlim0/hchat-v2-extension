import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  registerServer,
  removeServer,
  getServers,
  listTools,
  executeTool,
  listResources,
  getResource,
  testConnection,
  type McpServerConfig,
  type McpTool,
  type McpResource,
} from '../mcpClient'

beforeEach(async () => {
  await chrome.storage.local.clear()
  vi.restoreAllMocks()
  global.fetch = vi.fn()
})

function makeConfig(overrides?: Partial<McpServerConfig>): McpServerConfig {
  return {
    id: 'srv-1',
    name: 'Test Server',
    baseUrl: 'https://mcp.example.com',
    enabled: true,
    createdAt: Date.now(),
    ...overrides,
  }
}

// --- registerServer / removeServer / getServers ---

describe('registerServer', () => {
  it('stores a server config', async () => {
    const config = makeConfig()
    await registerServer(config)
    const servers = await getServers()
    expect(servers).toHaveLength(1)
    expect(servers[0]).toEqual(config)
  })

  it('appends multiple servers', async () => {
    await registerServer(makeConfig({ id: 'srv-1' }))
    await registerServer(makeConfig({ id: 'srv-2', name: 'Second' }))
    const servers = await getServers()
    expect(servers).toHaveLength(2)
  })

  it('rejects when max 10 servers reached', async () => {
    for (let i = 0; i < 10; i++) {
      await registerServer(makeConfig({ id: `srv-${i}` }))
    }
    await expect(
      registerServer(makeConfig({ id: 'srv-overflow' })),
    ).rejects.toThrow('Maximum 10 MCP servers allowed')
  })

  it('replaces existing server with same id', async () => {
    await registerServer(makeConfig({ id: 'srv-1', name: 'Original' }))
    await registerServer(makeConfig({ id: 'srv-1', name: 'Updated' }))
    const servers = await getServers()
    expect(servers).toHaveLength(1)
    expect(servers[0].name).toBe('Updated')
  })
})

describe('removeServer', () => {
  it('removes an existing server', async () => {
    await registerServer(makeConfig({ id: 'srv-1' }))
    await registerServer(makeConfig({ id: 'srv-2' }))
    await removeServer('srv-1')
    const servers = await getServers()
    expect(servers).toHaveLength(1)
    expect(servers[0].id).toBe('srv-2')
  })

  it('does nothing when server not found', async () => {
    await registerServer(makeConfig({ id: 'srv-1' }))
    await removeServer('nonexistent')
    const servers = await getServers()
    expect(servers).toHaveLength(1)
  })
})

describe('getServers', () => {
  it('returns empty array when none registered', async () => {
    const servers = await getServers()
    expect(servers).toEqual([])
  })
})

// --- listTools ---

describe('listTools', () => {
  it('returns tools from server', async () => {
    const tools: McpTool[] = [
      { name: 'search', description: 'Search docs', parameters: { query: { type: 'string', description: 'Search query', required: true } } },
    ]
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tools }),
    } as Response)

    await registerServer(makeConfig())
    const result = await listTools('srv-1')
    expect(result).toEqual(tools)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://mcp.example.com/tools',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('returns empty array when no tools', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tools: [] }),
    } as Response)

    await registerServer(makeConfig())
    const result = await listTools('srv-1')
    expect(result).toEqual([])
  })

  it('throws on fetch error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))
    await registerServer(makeConfig())
    await expect(listTools('srv-1')).rejects.toThrow('Network error')
  })
})

// --- executeTool ---

describe('executeTool', () => {
  it('executes tool and returns result', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, output: 'result data' }),
    } as Response)

    await registerServer(makeConfig())
    const result = await executeTool('srv-1', 'search', { query: 'test' })
    expect(result).toEqual({ success: true, output: 'result data' })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://mcp.example.com/tools/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      }),
    )
  })

  it('returns error result on non-ok response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    } as Response)

    await registerServer(makeConfig())
    const result = await executeTool('srv-1', 'search', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('400')
  })

  it('returns error result on network failure', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Connection refused'))
    await registerServer(makeConfig())
    const result = await executeTool('srv-1', 'broken', {})
    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection refused')
  })
})

// --- listResources / getResource ---

describe('listResources', () => {
  it('returns resources from server', async () => {
    const resources: McpResource[] = [
      { uri: 'file:///docs/readme.md', name: 'README', mimeType: 'text/markdown' },
    ]
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ resources }),
    } as Response)

    await registerServer(makeConfig())
    const result = await listResources('srv-1')
    expect(result).toEqual(resources)
  })

  it('throws on error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Timeout'))
    await registerServer(makeConfig())
    await expect(listResources('srv-1')).rejects.toThrow('Timeout')
  })
})

describe('getResource', () => {
  it('returns resource content as string', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => '# Hello World',
    } as Response)

    await registerServer(makeConfig())
    const content = await getResource('srv-1', 'file:///docs/readme.md')
    expect(content).toBe('# Hello World')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://mcp.example.com/resources?uri=file%3A%2F%2F%2Fdocs%2Freadme.md',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('throws on non-ok response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response)

    await registerServer(makeConfig())
    await expect(getResource('srv-1', 'missing')).rejects.toThrow('404')
  })
})

// --- testConnection ---

describe('testConnection', () => {
  it('returns true on 200 response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
    } as Response)

    const result = await testConnection(makeConfig())
    expect(result).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://mcp.example.com/health',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('returns false on 4xx/5xx response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response)

    const result = await testConnection(makeConfig())
    expect(result).toBe(false)
  })

  it('returns false on network error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('DNS error'))
    const result = await testConnection(makeConfig())
    expect(result).toBe(false)
  })
})

// --- apiKey header ---

describe('apiKey header', () => {
  it('includes Authorization header when apiKey is set', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tools: [] }),
    } as Response)

    await registerServer(makeConfig({ apiKey: 'secret-key' }))
    await listTools('srv-1')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-key',
        }),
      }),
    )
  })

  it('omits Authorization header when no apiKey', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tools: [] }),
    } as Response)

    await registerServer(makeConfig({ apiKey: undefined }))
    await listTools('srv-1')

    const callHeaders = vi.mocked(global.fetch).mock.calls[0][1]?.headers as Record<string, string>
    expect(callHeaders.Authorization).toBeUndefined()
  })
})

// --- disabled server ---

describe('disabled server', () => {
  it('throws error when server is disabled', async () => {
    await registerServer(makeConfig({ enabled: false }))
    await expect(listTools('srv-1')).rejects.toThrow('disabled')
  })
})

// --- server not found ---

describe('server not found', () => {
  it('throws when listing tools for non-existent server', async () => {
    await expect(listTools('nonexistent')).rejects.toThrow('Server not found')
  })

  it('throws when executing tool on non-existent server', async () => {
    await expect(executeTool('nonexistent', 'tool', {})).rejects.toThrow('Server not found')
  })

  it('throws when listing resources from non-existent server', async () => {
    await expect(listResources('nonexistent')).rejects.toThrow('Server not found')
  })

  it('throws when getting resource from non-existent server', async () => {
    await expect(getResource('nonexistent', 'uri')).rejects.toThrow('Server not found')
  })
})

// --- executeTool edge cases ---

describe('executeTool edge cases', () => {
  it('handles non-Error thrown exception', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce('string error')
    await registerServer(makeConfig())
    const result = await executeTool('srv-1', 'tool', {})
    expect(result.success).toBe(false)
    expect(result.error).toBe('Unknown error')
  })
})

// --- listTools null tools response ---

describe('listTools null response', () => {
  it('returns empty array when tools field is missing', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response)

    await registerServer(makeConfig())
    const result = await listTools('srv-1')
    expect(result).toEqual([])
  })
})

// --- listResources null response ---

describe('listResources null response', () => {
  it('returns empty array when resources field is missing', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response)

    await registerServer(makeConfig())
    const result = await listResources('srv-1')
    expect(result).toEqual([])
  })
})
