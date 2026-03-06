import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { McpServerManager } from '../McpServerManager'
import type { McpServerConfig, McpTool } from '../../lib/mcpClient'

const mockServers: McpServerConfig[] = [
  { id: 'srv-1', name: 'Server A', baseUrl: 'http://localhost:3001', enabled: true, createdAt: Date.now() },
  { id: 'srv-2', name: 'Server B', baseUrl: 'http://localhost:3002', apiKey: 'key-123', enabled: false, createdAt: Date.now() },
]

const mockTools: McpTool[] = [
  { name: 'search', description: 'Web search tool', parameters: {} },
  { name: 'calculator', description: 'Math calculator', parameters: {} },
]

const mockGetServers = vi.fn<() => Promise<McpServerConfig[]>>()
const mockRegisterServer = vi.fn<(config: McpServerConfig) => Promise<void>>()
const mockRemoveServer = vi.fn<(id: string) => Promise<void>>()
const mockListTools = vi.fn<(serverId: string) => Promise<McpTool[]>>()
const mockTestConnection = vi.fn<(config: McpServerConfig) => Promise<boolean>>()

vi.mock('../../lib/mcpClient', () => ({
  getServers: (...args: unknown[]) => mockGetServers(...(args as [])),
  registerServer: (...args: unknown[]) => mockRegisterServer(...(args as [McpServerConfig])),
  removeServer: (...args: unknown[]) => mockRemoveServer(...(args as [string])),
  listTools: (...args: unknown[]) => mockListTools(...(args as [string])),
  testConnection: (...args: unknown[]) => mockTestConnection(...(args as [McpServerConfig])),
}))

vi.mock('../../i18n', () => ({
  useLocale: () => ({
    t: (key: string) => key,
    locale: 'ko',
  }),
}))

describe('McpServerManager', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServers.mockResolvedValue([...mockServers])
    mockRegisterServer.mockResolvedValue(undefined)
    mockRemoveServer.mockResolvedValue(undefined)
    mockListTools.mockResolvedValue([...mockTools])
    mockTestConnection.mockResolvedValue(true)
  })

  it('서버 목록 렌더링', async () => {
    render(<McpServerManager onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('Server A')).toBeDefined()
      expect(screen.getByText('Server B')).toBeDefined()
    })
  })

  it('닫기 버튼 클릭 시 onClose 호출', async () => {
    render(<McpServerManager onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('Server A')).toBeDefined()
    })
    const closeBtn = screen.getByText('common.close')
    fireEvent.click(closeBtn)
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('서버 추가 폼 입력 및 등록', async () => {
    render(<McpServerManager onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('Server A')).toBeDefined()
    })

    const nameInput = screen.getByPlaceholderText('mcp.namePlaceholder')
    const urlInput = screen.getByPlaceholderText('mcp.urlPlaceholder')
    fireEvent.change(nameInput, { target: { value: 'New Server' } })
    fireEvent.change(urlInput, { target: { value: 'http://localhost:4000' } })

    const addBtn = screen.getByText('mcp.addServer')
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(mockRegisterServer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Server',
          baseUrl: 'http://localhost:4000',
          enabled: true,
        }),
      )
    })
  })

  it('연결 테스트 성공 표시', async () => {
    mockTestConnection.mockResolvedValue(true)
    render(<McpServerManager onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('Server A')).toBeDefined()
    })

    const testBtns = screen.getAllByText('mcp.testConnection')
    fireEvent.click(testBtns[0])

    await waitFor(() => {
      expect(screen.getByText('mcp.connected')).toBeDefined()
    })
  })

  it('연결 테스트 실패 표시', async () => {
    mockTestConnection.mockResolvedValue(false)
    render(<McpServerManager onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('Server A')).toBeDefined()
    })

    const testBtns = screen.getAllByText('mcp.testConnection')
    fireEvent.click(testBtns[0])

    await waitFor(() => {
      expect(screen.getByText('mcp.failed')).toBeDefined()
    })
  })

  it('서버 활성화/비활성화 토글', async () => {
    render(<McpServerManager onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('Server B')).toBeDefined()
    })

    // Server B is disabled, toggle it
    const toggleBtns = screen.getAllByRole('checkbox')
    // Server A = checked, Server B = unchecked
    fireEvent.click(toggleBtns[1])

    await waitFor(() => {
      expect(mockRegisterServer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'srv-2', enabled: true }),
      )
    })
  })

  it('서버 삭제', async () => {
    render(<McpServerManager onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('Server A')).toBeDefined()
    })

    const removeBtns = screen.getAllByText('mcp.remove')
    fireEvent.click(removeBtns[0])

    await waitFor(() => {
      expect(mockRemoveServer).toHaveBeenCalledWith('srv-1')
    })
  })

  it('도구 목록 보기', async () => {
    render(<McpServerManager onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('Server A')).toBeDefined()
    })

    const toolBtns = screen.getAllByText('mcp.tools')
    fireEvent.click(toolBtns[0])

    await waitFor(() => {
      expect(screen.getByText('search')).toBeDefined()
      expect(screen.getByText('Web search tool')).toBeDefined()
      expect(screen.getByText('calculator')).toBeDefined()
    })
  })

  it('빈 이름/URL로 서버 추가 시 등록하지 않음', async () => {
    render(<McpServerManager onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('Server A')).toBeDefined()
    })

    const addBtn = screen.getByText('mcp.addServer')
    fireEvent.click(addBtn)

    expect(mockRegisterServer).not.toHaveBeenCalled()
  })

  it('서버 추가 후 폼 초기화 및 목록 새로고침', async () => {
    const updatedServers = [
      ...mockServers,
      { id: 'srv-3', name: 'New Server', baseUrl: 'http://localhost:4000', enabled: true, createdAt: Date.now() },
    ]
    mockGetServers
      .mockResolvedValueOnce([...mockServers])
      .mockResolvedValueOnce(updatedServers)

    render(<McpServerManager onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('Server A')).toBeDefined()
    })

    const nameInput = screen.getByPlaceholderText('mcp.namePlaceholder') as HTMLInputElement
    const urlInput = screen.getByPlaceholderText('mcp.urlPlaceholder') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'New Server' } })
    fireEvent.change(urlInput, { target: { value: 'http://localhost:4000' } })

    const addBtn = screen.getByText('mcp.addServer')
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(nameInput.value).toBe('')
      expect(urlInput.value).toBe('')
    })
  })
})
