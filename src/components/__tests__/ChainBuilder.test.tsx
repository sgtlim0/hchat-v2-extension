import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChainBuilder from '../ChainBuilder'
import type { Config } from '../../types'
import { setupI18nMock } from '../../test/mocks/i18n'

// Mock assistantChain module
vi.mock('../../lib/assistantChain', () => ({
  getChains: vi.fn(),
  saveChain: vi.fn(),
  deleteChain: vi.fn(),
  exportChains: vi.fn(),
  importChains: vi.fn(),
}))

// Mock assistantBuilder module
vi.mock('../../lib/assistantBuilder', () => ({
  getAssistants: vi.fn().mockResolvedValue([
    { id: 'a1', name: '번역 전문가', icon: '🌐' },
    { id: 'a2', name: '코드 리뷰어', icon: '💻' },
    { id: 'a3', name: '글쓰기 도우미', icon: '✍️' },
  ])
}))

import * as assistantChain from '../../lib/assistantChain'
import * as assistantBuilder from '../../lib/assistantBuilder'

describe('ChainBuilder', () => {
  const mockConfig: Config = {
    provider: 'bedrock',
    aws: {
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    },
    openai: { apiKey: '' },
    gemini: { apiKey: '' },
    theme: 'system',
    locale: 'ko',
    defaultModel: 'claude-sonnet',
    thinkingDepth: 'normal',
    showProvider: true,
    searchEngine: 'perplexity',
    searchApiKey: '',
    usage: { enabled: true, warningThreshold: 80 },
  }

  const mockOnClose = vi.fn()
  const mockOnRunChain = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    setupI18nMock()
  })

  it('체인 목록 렌더링 - 빈 목록', async () => {
    vi.mocked(assistantChain.getChains).mockResolvedValue([])

    render(
      <ChainBuilder
        config={mockConfig}
        onClose={mockOnClose}
        onRunChain={mockOnRunChain}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('비서 체인')).toBeInTheDocument()
      expect(screen.getByText('체인 생성')).toBeInTheDocument()
    })
  })

  it('체인 목록 렌더링 - 체인 있는 목록', async () => {
    vi.mocked(assistantChain.getChains).mockResolvedValue([
      {
        id: 'chain1',
        name: '번역 → 검토 체인',
        steps: [
          { assistantId: 'a1', promptTemplate: '다음을 영어로 번역: {{input}}' },
          { assistantId: 'a2', promptTemplate: '번역 검토: {{input}}' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ])

    render(
      <ChainBuilder
        config={mockConfig}
        onClose={mockOnClose}
        onRunChain={mockOnRunChain}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('번역 → 검토 체인')).toBeInTheDocument()
      expect(screen.getByText('체인 실행')).toBeInTheDocument()
    })
  })

  it('체인 생성 버튼 클릭 → 편집 모드 전환', async () => {
    vi.mocked(assistantChain.getChains).mockResolvedValue([])

    render(
      <ChainBuilder
        config={mockConfig}
        onClose={mockOnClose}
      />
    )

    const createButton = await screen.findByText('체인 생성')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('체인 이름')).toBeInTheDocument()
      expect(screen.getByText('단계 추가')).toBeInTheDocument()
    })
  })

  it('단계 추가/삭제 (min 2, max 10 제한)', async () => {
    vi.mocked(assistantChain.getChains).mockResolvedValue([])

    render(
      <ChainBuilder
        config={mockConfig}
        onClose={mockOnClose}
      />
    )

    const createButton = await screen.findByText('체인 생성')
    fireEvent.click(createButton)

    // 초기 2개 단계가 있어야 함
    await waitFor(() => {
      const steps = screen.getAllByText('비서 선택')
      expect(steps).toHaveLength(2)
    })

    // 단계 추가 (최대 10개까지)
    const addButton = screen.getByText('단계 추가')
    for (let i = 2; i < 10; i++) {
      fireEvent.click(addButton)
    }

    await waitFor(() => {
      const steps = screen.getAllByText('비서 선택')
      expect(steps).toHaveLength(10)
    })

    // 더 이상 추가 불가 (max 10)
    expect(addButton).toBeDisabled()

    // 단계 삭제 (min 2까지)
    for (let i = 0; i < 8; i++) {
      const removeButtons = screen.getAllByText('단계 삭제')
      fireEvent.click(removeButtons[removeButtons.length - 1])
      await waitFor(() => {})
    }

    await waitFor(() => {
      const steps = screen.getAllByText('비서 선택')
      expect(steps).toHaveLength(2)
    })

    // 더 이상 삭제 불가 (min 2)
    const remainingRemoveButtons = screen.getAllByText('단계 삭제')
    expect(remainingRemoveButtons[0]).toBeDisabled()
    expect(remainingRemoveButtons[1]).toBeDisabled()
  })

  it('비서 선택 드롭다운 동작', async () => {
    vi.mocked(assistantChain.getChains).mockResolvedValue([])

    render(
      <ChainBuilder
        config={mockConfig}
        onClose={mockOnClose}
      />
    )

    const createButton = await screen.findByText('체인 생성')
    fireEvent.click(createButton)

    await waitFor(async () => {
      const selects = screen.getAllByRole('combobox')
      expect(selects[0]).toBeInTheDocument()

      fireEvent.change(selects[0], { target: { value: 'a1' } })

      expect(selects[0]).toHaveValue('a1')
    })
  })

  it('프롬프트 템플릿 입력', async () => {
    vi.mocked(assistantChain.getChains).mockResolvedValue([])

    render(
      <ChainBuilder
        config={mockConfig}
        onClose={mockOnClose}
      />
    )

    const createButton = await screen.findByText('체인 생성')
    fireEvent.click(createButton)

    await waitFor(() => {
      const textareas = screen.getAllByPlaceholderText(/프롬프트 템플릿/)
      expect(textareas[0]).toBeInTheDocument()

      fireEvent.change(textareas[0], {
        target: { value: '다음을 번역해주세요: {{input}}' }
      })

      expect(textareas[0]).toHaveValue('다음을 번역해주세요: {{input}}')
    })
  })

  it('체인 저장 → assistantChain.saveChain() 호출', async () => {
    vi.mocked(assistantChain.getChains).mockResolvedValue([])
    vi.mocked(assistantChain.saveChain).mockResolvedValue({
      id: 'new-chain',
      name: '테스트 체인',
      steps: [
        { assistantId: 'a1', promptTemplate: '{{input}}' },
        { assistantId: 'a2', promptTemplate: '{{input}}' },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    render(
      <ChainBuilder
        config={mockConfig}
        onClose={mockOnClose}
      />
    )

    const createButton = await screen.findByText('체인 생성')
    fireEvent.click(createButton)

    // 이름 입력
    const nameInput = await screen.findByPlaceholderText('체인 이름')
    fireEvent.change(nameInput, { target: { value: '테스트 체인' } })

    // 비서 선택
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'a1' } })
    fireEvent.change(selects[1], { target: { value: 'a2' } })

    // 프롬프트 입력
    const textareas = screen.getAllByPlaceholderText(/프롬프트 템플릿/)
    fireEvent.change(textareas[0], { target: { value: '{{input}}' } })
    fireEvent.change(textareas[1], { target: { value: '{{input}}' } })

    // 저장
    const saveButton = screen.getByText('저장')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(assistantChain.saveChain).toHaveBeenCalledWith({
        name: '테스트 체인',
        steps: [
          { assistantId: 'a1', promptTemplate: '{{input}}' },
          { assistantId: 'a2', promptTemplate: '{{input}}' },
        ],
      })
    })
  })

  it('체인 삭제 → assistantChain.deleteChain() 호출', async () => {
    vi.mocked(assistantChain.getChains).mockResolvedValue([
      {
        id: 'chain1',
        name: '삭제할 체인',
        steps: [
          { assistantId: 'a1', promptTemplate: '{{input}}' },
          { assistantId: 'a2', promptTemplate: '{{input}}' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ])

    render(
      <ChainBuilder
        config={mockConfig}
        onClose={mockOnClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('삭제할 체인')).toBeInTheDocument()
    })

    const deleteButton = screen.getByText('삭제')
    fireEvent.click(deleteButton)

    // 확인 다이얼로그에서 확인 클릭
    const confirmButton = await screen.findByText('확인')
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(assistantChain.deleteChain).toHaveBeenCalledWith('chain1')
    })
  })

  it('Export 버튼 → JSON 다운로드', async () => {
    vi.mocked(assistantChain.getChains).mockResolvedValue([
      {
        id: 'chain1',
        name: '체인1',
        steps: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ])
    vi.mocked(assistantChain.exportChains).mockResolvedValue(
      JSON.stringify([{ id: 'chain1', name: '체인1' }])
    )

    // Blob과 URL.createObjectURL을 모킹
    const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
    const mockRevokeObjectURL = vi.fn()
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    render(
      <ChainBuilder
        config={mockConfig}
        onClose={mockOnClose}
      />
    )

    const exportButton = await screen.findByText('전체 내보내기')
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(assistantChain.exportChains).toHaveBeenCalled()
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })
  })

  it('Import 버튼 → JSON 파싱', async () => {
    vi.mocked(assistantChain.getChains).mockResolvedValue([])
    vi.mocked(assistantChain.importChains).mockResolvedValue(2)

    render(
      <ChainBuilder
        config={mockConfig}
        onClose={mockOnClose}
      />
    )

    const importButton = await screen.findByText('가져오기')

    // 파일 입력 시뮬레이션
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    const file = new File(
      [JSON.stringify([{ name: 'imported chain' }])],
      'chains.json',
      { type: 'application/json' }
    )

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    })

    // import 버튼 클릭이 파일 input을 트리거하도록 설정
    const importClickHandler = () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    }

    fireEvent.click(importButton)

    // 파일 읽기 시뮬레이션
    await waitFor(async () => {
      const reader = new FileReader()
      reader.onload = async () => {
        await assistantChain.importChains(reader.result as string)
      }
      reader.readAsText(file)
    })
  })

  it('닫기 버튼 → onClose 콜백', async () => {
    vi.mocked(assistantChain.getChains).mockResolvedValue([])

    render(
      <ChainBuilder
        config={mockConfig}
        onClose={mockOnClose}
      />
    )

    const closeButton = await screen.findByText('닫기')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('체인 실행 버튼 → onRunChain 콜백', async () => {
    vi.mocked(assistantChain.getChains).mockResolvedValue([
      {
        id: 'chain1',
        name: '실행할 체인',
        steps: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ])

    render(
      <ChainBuilder
        config={mockConfig}
        onClose={mockOnClose}
        onRunChain={mockOnRunChain}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('실행할 체인')).toBeInTheDocument()
    })

    const runButton = screen.getByText('체인 실행')
    fireEvent.click(runButton)

    expect(mockOnRunChain).toHaveBeenCalledWith('chain1')
  })

  it('체인 이름 편집', async () => {
    vi.mocked(assistantChain.getChains).mockResolvedValue([
      {
        id: 'chain1',
        name: '기존 체인',
        steps: [
          { assistantId: 'a1', promptTemplate: '{{input}}' },
          { assistantId: 'a2', promptTemplate: '{{input}}' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ])

    render(
      <ChainBuilder
        config={mockConfig}
        onClose={mockOnClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('기존 체인')).toBeInTheDocument()
    })

    // 편집 버튼 클릭
    const editButton = screen.getByText('편집')
    fireEvent.click(editButton)

    // 이름 변경
    const nameInput = await screen.findByDisplayValue('기존 체인')
    fireEvent.change(nameInput, { target: { value: '변경된 체인' } })

    // 저장
    const saveButton = screen.getByText('저장')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(assistantChain.saveChain).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '변경된 체인',
        })
      )
    })
  })
})