import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConversationTreeView } from '../ConversationTreeView'
import type { ConvMeta } from '../../lib/conversationTree'
import { getBranchInfo } from '../../lib/conversationTree'

// Mock conversationTree
vi.mock('../../lib/conversationTree', () => ({
  buildTree: vi.fn((conversations: ConvMeta[]) => {
    // Simple mock: root nodes have no forkedFrom, children nested under parent
    const nodeMap = new Map<string, any>()
    for (const conv of conversations) {
      nodeMap.set(conv.id, { conv, children: [], depth: 0 })
    }
    const roots: any[] = []
    for (const conv of conversations) {
      const node = nodeMap.get(conv.id)!
      if (!conv.forkedFrom || !nodeMap.has(conv.forkedFrom)) {
        roots.push(node)
      } else {
        const parent = nodeMap.get(conv.forkedFrom)!
        node.depth = parent.depth + 1
        parent.children.push(node)
      }
    }
    return roots
  }),
  getBranchInfo: vi.fn(() => ({
    totalBranches: 3,
    maxDepth: 2,
    mostActive: 'conv-1',
  })),
  findNode: vi.fn(),
  getAncestors: vi.fn(() => []),
}))

// Mock i18n
vi.mock('../../i18n', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        'tree.title': '대화 트리',
        'tree.branches': '분기',
        'tree.maxDepth': '최대 깊이',
        'tree.messages': '메시지',
        'tree.noForks': '분기 없음',
        'tree.forkedFrom': '분기 원본',
        'tree.select': '대화 선택',
        'tree.close': '닫기',
      }
      let result = map[key] ?? key
      if (params) {
        result = result.replace(/\{(\w+)\}/g, (_, k) =>
          params[k] != null ? String(params[k]) : `{${k}}`,
        )
      }
      return result
    },
    locale: 'ko',
  }),
}))

const makeConv = (
  id: string,
  title: string,
  messageCount: number,
  forkedFrom?: string,
): ConvMeta => ({
  id,
  title,
  messageCount,
  createdAt: Date.now() - 10000,
  updatedAt: Date.now(),
  forkedFrom,
})

describe('ConversationTreeView', () => {
  const mockOnSelectConv = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    mockOnSelectConv.mockClear()
    mockOnClose.mockClear()
  })

  const baseConvs: ConvMeta[] = [
    makeConv('conv-1', 'Root Conversation', 10),
    makeConv('conv-2', 'Forked Chat', 5, 'conv-1'),
    makeConv('conv-3', 'Deep Fork', 3, 'conv-2'),
  ]

  it('트리 제목과 닫기 버튼 렌더링', () => {
    render(
      <ConversationTreeView
        conversations={baseConvs}
        onSelectConv={mockOnSelectConv}
        onClose={mockOnClose}
      />,
    )
    expect(screen.getByText('대화 트리')).toBeDefined()
    expect(screen.getByText('닫기')).toBeDefined()
  })

  it('브랜치 정보 헤더 표시', () => {
    render(
      <ConversationTreeView
        conversations={baseConvs}
        onSelectConv={mockOnSelectConv}
        onClose={mockOnClose}
      />,
    )
    // totalBranches: 3, maxDepth: 2
    expect(screen.getByText('3 분기')).toBeDefined()
    expect(screen.getByText(/최대 깊이.*2/)).toBeDefined()
  })

  it('각 대화 노드의 제목 표시', () => {
    render(
      <ConversationTreeView
        conversations={baseConvs}
        onSelectConv={mockOnSelectConv}
        onClose={mockOnClose}
      />,
    )
    expect(screen.getByText('Root Conversation')).toBeDefined()
    expect(screen.getByText('Forked Chat')).toBeDefined()
    expect(screen.getByText('Deep Fork')).toBeDefined()
  })

  it('각 노드에 메시지 수 표시', () => {
    render(
      <ConversationTreeView
        conversations={baseConvs}
        onSelectConv={mockOnSelectConv}
        onClose={mockOnClose}
      />,
    )
    expect(screen.getByText('10 메시지')).toBeDefined()
    expect(screen.getByText('5 메시지')).toBeDefined()
    expect(screen.getByText('3 메시지')).toBeDefined()
  })

  it('노드 클릭 시 onSelectConv 호출', () => {
    render(
      <ConversationTreeView
        conversations={baseConvs}
        onSelectConv={mockOnSelectConv}
        onClose={mockOnClose}
      />,
    )
    fireEvent.click(screen.getByText('Forked Chat'))
    expect(mockOnSelectConv).toHaveBeenCalledWith('conv-2')
  })

  it('닫기 버튼 클릭 시 onClose 호출', () => {
    render(
      <ConversationTreeView
        conversations={baseConvs}
        onSelectConv={mockOnSelectConv}
        onClose={mockOnClose}
      />,
    )
    fireEvent.click(screen.getByText('닫기'))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('자식 노드가 있는 노드에 분기 아이콘 표시', () => {
    const { container } = render(
      <ConversationTreeView
        conversations={baseConvs}
        onSelectConv={mockOnSelectConv}
        onClose={mockOnClose}
      />,
    )
    // conv-1 has children, conv-2 has children, conv-3 does not
    const branchIcons = container.querySelectorAll('.tree-branch-icon')
    expect(branchIcons.length).toBe(2)
  })

  it('depth에 따른 들여쓰기 적용', () => {
    const { container } = render(
      <ConversationTreeView
        conversations={baseConvs}
        onSelectConv={mockOnSelectConv}
        onClose={mockOnClose}
      />,
    )
    const nodes = container.querySelectorAll('.tree-node')
    // depth 0: 0px, depth 1: 20px, depth 2: 40px
    expect((nodes[0] as HTMLElement).style.paddingLeft).toBe('0px')
    expect((nodes[1] as HTMLElement).style.paddingLeft).toBe('20px')
    expect((nodes[2] as HTMLElement).style.paddingLeft).toBe('40px')
  })

  it('빈 대화 목록 시 분기 없음 메시지 표시', () => {
    vi.mocked(getBranchInfo).mockReturnValueOnce({ totalBranches: 0, maxDepth: 0, mostActive: '' })

    render(
      <ConversationTreeView
        conversations={[]}
        onSelectConv={mockOnSelectConv}
        onClose={mockOnClose}
      />,
    )
    expect(screen.getByText('분기 없음')).toBeDefined()
  })

  it('forkedFrom이 있는 노드에 분기 원본 표시', () => {
    render(
      <ConversationTreeView
        conversations={baseConvs}
        onSelectConv={mockOnSelectConv}
        onClose={mockOnClose}
      />,
    )
    // conv-2 and conv-3 have forkedFrom
    const forkedLabels = screen.getAllByText('분기 원본')
    expect(forkedLabels.length).toBe(2)
  })
})
