import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WorkflowEditor } from '../WorkflowEditor'
import type { Workflow, ValidationResult, WorkflowResult } from '../../lib/workflowBuilder'

// Mock workflowBuilder
const mockGetWorkflows = vi.fn<() => Promise<Workflow[]>>().mockResolvedValue([])
const mockSaveWorkflow = vi.fn().mockResolvedValue({
  id: 'wf1',
  name: 'Test',
  nodes: [],
  startNodeId: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
const mockDeleteWorkflow = vi.fn().mockResolvedValue(undefined)
const mockValidateWorkflow = vi.fn<(wf: Workflow) => ValidationResult>().mockReturnValue({ valid: true, errors: [] })
const mockExecuteWorkflow = vi.fn<() => Promise<WorkflowResult>>().mockResolvedValue({
  success: true,
  output: 'result',
  steps: [],
  error: undefined,
})
const mockExportWorkflows = vi.fn().mockResolvedValue('[]')
const mockImportWorkflows = vi.fn().mockResolvedValue(0)

vi.mock('../../lib/workflowBuilder', () => ({
  getWorkflows: (...args: unknown[]) => mockGetWorkflows(...args as []),
  saveWorkflow: (...args: unknown[]) => mockSaveWorkflow(...args as []),
  deleteWorkflow: (...args: unknown[]) => mockDeleteWorkflow(...args as []),
  validateWorkflow: (...args: unknown[]) => mockValidateWorkflow(...args as []),
  executeWorkflow: (...args: unknown[]) => mockExecuteWorkflow(...args as []),
  exportWorkflows: (...args: unknown[]) => mockExportWorkflows(...args as []),
  importWorkflows: (...args: unknown[]) => mockImportWorkflows(...args as []),
}))

// Mock i18n
vi.mock('../../i18n', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'workflow.title': '워크플로우',
        'workflow.create': '생성',
        'workflow.addNode': '노드 추가',
        'workflow.removeNode': '노드 삭제',
        'workflow.validate': '검증',
        'workflow.run': '실행',
        'workflow.result': '결과',
        'workflow.error': '오류',
        'workflow.export': '내보내기',
        'workflow.import': '가져오기',
        'workflow.nodeType': '노드 타입',
        'workflow.input': '초기 입력',
        'common.close': '닫기',
        'common.save': '저장',
        'common.delete': '삭제',
        'common.edit': '편집',
      }
      return map[key] ?? key
    },
    locale: 'ko',
  }),
}))

describe('WorkflowEditor', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWorkflows.mockResolvedValue([])
  })

  it('타이틀과 닫기 버튼 렌더링', async () => {
    render(<WorkflowEditor onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('워크플로우')).toBeDefined()
    })
    expect(screen.getByText('닫기')).toBeDefined()
  })

  it('닫기 버튼 클릭 시 onClose 호출', async () => {
    render(<WorkflowEditor onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('닫기')).toBeDefined()
    })
    fireEvent.click(screen.getByText('닫기'))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('워크플로우 목록 로드 및 표시', async () => {
    mockGetWorkflows.mockResolvedValue([
      { id: 'wf1', name: 'Flow A', nodes: [], startNodeId: '', createdAt: 1000, updatedAt: 1000 },
      { id: 'wf2', name: 'Flow B', nodes: [], startNodeId: '', createdAt: 2000, updatedAt: 2000 },
    ])
    render(<WorkflowEditor onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('Flow A')).toBeDefined()
      expect(screen.getByText('Flow B')).toBeDefined()
    })
  })

  it('생성 버튼 클릭 시 편집 모드 진입', async () => {
    render(<WorkflowEditor onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('생성')).toBeDefined()
    })
    fireEvent.click(screen.getByText('생성'))
    expect(screen.getByText('노드 추가')).toBeDefined()
  })

  it('노드 추가 시 타입 선택 및 노드 리스트 갱신', async () => {
    render(<WorkflowEditor onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('생성')).toBeDefined()
    })
    fireEvent.click(screen.getByText('생성'))

    const typeSelect = screen.getByDisplayValue('ai_call')
    expect(typeSelect).toBeDefined()

    fireEvent.click(screen.getByText('노드 추가'))
    // Node should appear in the list
    expect(screen.getByText('ai_call-1')).toBeDefined()
  })

  it('노드 삭제 시 리스트에서 제거', async () => {
    render(<WorkflowEditor onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('생성')).toBeDefined()
    })
    fireEvent.click(screen.getByText('생성'))
    fireEvent.click(screen.getByText('노드 추가'))
    expect(screen.getByText('ai_call-1')).toBeDefined()

    fireEvent.click(screen.getByText('노드 삭제'))
    expect(screen.queryByText('ai_call-1')).toBeNull()
  })

  it('검증 버튼 클릭 시 validateWorkflow 호출 및 결과 표시', async () => {
    mockValidateWorkflow.mockReturnValue({ valid: false, errors: ['최소 1개의 노드가 필요합니다'] })
    render(<WorkflowEditor onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('생성')).toBeDefined()
    })
    fireEvent.click(screen.getByText('생성'))
    fireEvent.click(screen.getByText('검증'))

    expect(mockValidateWorkflow).toHaveBeenCalled()
    expect(screen.getByText('최소 1개의 노드가 필요합니다')).toBeDefined()
  })

  it('실행 버튼 클릭 시 executeWorkflow 호출 및 결과 표시', async () => {
    mockExecuteWorkflow.mockResolvedValue({ success: true, output: 'AI result', steps: [], error: undefined })
    render(<WorkflowEditor onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('생성')).toBeDefined()
    })
    fireEvent.click(screen.getByText('생성'))
    fireEvent.click(screen.getByText('노드 추가'))

    const inputField = screen.getByPlaceholderText('초기 입력')
    fireEvent.change(inputField, { target: { value: 'test input' } })
    fireEvent.click(screen.getByText('실행'))

    await waitFor(() => {
      expect(screen.getByText('AI result')).toBeDefined()
    })
  })

  it('저장 버튼 클릭 시 saveWorkflow 호출', async () => {
    render(<WorkflowEditor onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('생성')).toBeDefined()
    })
    fireEvent.click(screen.getByText('생성'))
    fireEvent.click(screen.getByText('노드 추가'))
    fireEvent.click(screen.getByText('저장'))

    await waitFor(() => {
      expect(mockSaveWorkflow).toHaveBeenCalled()
    })
  })

  it('삭제 버튼 클릭 시 deleteWorkflow 호출', async () => {
    mockGetWorkflows.mockResolvedValue([
      { id: 'wf1', name: 'Flow A', nodes: [], startNodeId: '', createdAt: 1000, updatedAt: 1000 },
    ])
    render(<WorkflowEditor onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('Flow A')).toBeDefined()
    })
    fireEvent.click(screen.getByText('삭제'))

    await waitFor(() => {
      expect(mockDeleteWorkflow).toHaveBeenCalledWith('wf1')
    })
  })

  it('Export 버튼 클릭 시 exportWorkflows 호출', async () => {
    const createObjectURL = vi.fn(() => 'blob:test')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    })

    render(<WorkflowEditor onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('내보내기')).toBeDefined()
    })
    fireEvent.click(screen.getByText('내보내기'))

    await waitFor(() => {
      expect(mockExportWorkflows).toHaveBeenCalled()
    })
  })

  it('Import 시 importWorkflows 호출', async () => {
    mockImportWorkflows.mockResolvedValue(2)
    render(<WorkflowEditor onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('가져오기')).toBeDefined()
    })

    const importLabel = screen.getByText('가져오기')
    const input = importLabel.closest('label')?.querySelector('input[type="file"]')
    expect(input).toBeDefined()

    const file = new File(['{"version":1,"workflows":[]}'], 'workflows.json', { type: 'application/json' })
    Object.defineProperty(input!, 'files', { value: [file] })
    fireEvent.change(input!)

    await waitFor(() => {
      expect(mockImportWorkflows).toHaveBeenCalled()
    })
  })

  it('condition 노드 타입 선택 시 trueBranch/falseBranch 설정 표시', async () => {
    render(<WorkflowEditor onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('생성')).toBeDefined()
    })
    fireEvent.click(screen.getByText('생성'))

    const typeSelect = screen.getByDisplayValue('ai_call')
    fireEvent.change(typeSelect, { target: { value: 'condition' } })
    fireEvent.click(screen.getByText('노드 추가'))

    expect(screen.getByPlaceholderText('pattern')).toBeDefined()
    expect(screen.getByDisplayValue('contains')).toBeDefined()
  })
})
