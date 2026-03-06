// lib/__tests__/conversationTree.test.ts — Tests for conversation tree module

import { describe, it, expect } from 'vitest'
import {
  buildTree,
  findNode,
  getAncestors,
  getDescendants,
  getBranchInfo,
  compareBranches,
  mergeBranches,
  type ConvMeta,
  type TreeNode,
} from '../conversationTree'

// --- Helpers ---

const mkConv = (overrides: Partial<ConvMeta> & { id: string }): ConvMeta => ({
  title: `Conv ${overrides.id}`,
  messageCount: 5,
  createdAt: 1000,
  updatedAt: 2000,
  ...overrides,
})

// --- buildTree ---

describe('buildTree', () => {
  it('returns empty array for empty input', () => {
    expect(buildTree([])).toEqual([])
  })

  it('returns roots only when no forks', () => {
    const convs = [mkConv({ id: 'a' }), mkConv({ id: 'b' })]
    const tree = buildTree(convs)
    expect(tree).toHaveLength(2)
    expect(tree.every((n) => n.depth === 0)).toBe(true)
    expect(tree.every((n) => n.children.length === 0)).toBe(true)
  })

  it('builds 1-level parent-child relationship', () => {
    const convs = [
      mkConv({ id: 'root' }),
      mkConv({ id: 'child', forkedFrom: 'root' }),
    ]
    const tree = buildTree(convs)
    expect(tree).toHaveLength(1)
    expect(tree[0].conv.id).toBe('root')
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].conv.id).toBe('child')
    expect(tree[0].children[0].depth).toBe(1)
  })

  it('builds multi-level tree', () => {
    const convs = [
      mkConv({ id: 'a' }),
      mkConv({ id: 'b', forkedFrom: 'a' }),
      mkConv({ id: 'c', forkedFrom: 'b' }),
      mkConv({ id: 'd', forkedFrom: 'c' }),
    ]
    const tree = buildTree(convs)
    expect(tree).toHaveLength(1)
    expect(tree[0].children[0].children[0].children[0].conv.id).toBe('d')
    expect(tree[0].children[0].children[0].children[0].depth).toBe(3)
  })

  it('limits depth to max 5', () => {
    const convs = [
      mkConv({ id: 'd0' }),
      mkConv({ id: 'd1', forkedFrom: 'd0' }),
      mkConv({ id: 'd2', forkedFrom: 'd1' }),
      mkConv({ id: 'd3', forkedFrom: 'd2' }),
      mkConv({ id: 'd4', forkedFrom: 'd3' }),
      mkConv({ id: 'd5', forkedFrom: 'd4' }), // depth 5 — allowed
      mkConv({ id: 'd6', forkedFrom: 'd5' }), // depth 6 — should be clamped to root
    ]
    const tree = buildTree(convs)
    // d6 should not be nested at depth 6; it becomes a root
    const allIds = flattenIds(tree)
    expect(allIds).toContain('d6')
    const d6Node = findNode(tree, 'd6')
    expect(d6Node).not.toBeNull()
    // d6 should not be deeper than 5
    expect(d6Node!.depth).toBeLessThanOrEqual(5)
  })
})

// --- findNode ---

describe('findNode', () => {
  it('finds root node', () => {
    const tree = buildTree([mkConv({ id: 'root' })])
    const node = findNode(tree, 'root')
    expect(node).not.toBeNull()
    expect(node!.conv.id).toBe('root')
  })

  it('finds deeply nested child', () => {
    const convs = [
      mkConv({ id: 'a' }),
      mkConv({ id: 'b', forkedFrom: 'a' }),
      mkConv({ id: 'c', forkedFrom: 'b' }),
    ]
    const tree = buildTree(convs)
    const node = findNode(tree, 'c')
    expect(node).not.toBeNull()
    expect(node!.conv.id).toBe('c')
    expect(node!.depth).toBe(2)
  })

  it('returns null for non-existent ID', () => {
    const tree = buildTree([mkConv({ id: 'a' })])
    expect(findNode(tree, 'not-exist')).toBeNull()
  })
})

// --- getAncestors ---

describe('getAncestors', () => {
  it('returns empty array for root node', () => {
    const convs = [mkConv({ id: 'root' })]
    const tree = buildTree(convs)
    expect(getAncestors(tree, 'root')).toEqual([])
  })

  it('returns parent chain for deep node', () => {
    const convs = [
      mkConv({ id: 'a' }),
      mkConv({ id: 'b', forkedFrom: 'a' }),
      mkConv({ id: 'c', forkedFrom: 'b' }),
    ]
    const tree = buildTree(convs)
    const ancestors = getAncestors(tree, 'c')
    expect(ancestors).toEqual(['b', 'a'])
  })

  it('returns empty array for non-existent ID', () => {
    const tree = buildTree([mkConv({ id: 'a' })])
    expect(getAncestors(tree, 'missing')).toEqual([])
  })
})

// --- getDescendants ---

describe('getDescendants', () => {
  it('returns empty array for leaf node', () => {
    const tree = buildTree([mkConv({ id: 'leaf' })])
    expect(getDescendants(tree[0])).toEqual([])
  })

  it('returns all descendants for node with children', () => {
    const convs = [
      mkConv({ id: 'a' }),
      mkConv({ id: 'b', forkedFrom: 'a' }),
      mkConv({ id: 'c', forkedFrom: 'a' }),
      mkConv({ id: 'd', forkedFrom: 'b' }),
    ]
    const tree = buildTree(convs)
    const descendants = getDescendants(tree[0])
    expect(descendants.sort()).toEqual(['b', 'c', 'd'])
  })
})

// --- getBranchInfo ---

describe('getBranchInfo', () => {
  it('returns zeros for empty tree', () => {
    const info = getBranchInfo([])
    expect(info.totalBranches).toBe(0)
    expect(info.maxDepth).toBe(0)
    expect(info.mostActive).toBe('')
  })

  it('returns info for single root', () => {
    const tree = buildTree([mkConv({ id: 'a', messageCount: 10, updatedAt: 5000 })])
    const info = getBranchInfo(tree)
    expect(info.totalBranches).toBe(1)
    expect(info.maxDepth).toBe(0)
    expect(info.mostActive).toBe('a')
  })

  it('identifies most active branch in complex tree', () => {
    const convs = [
      mkConv({ id: 'a', messageCount: 3 }),
      mkConv({ id: 'b', forkedFrom: 'a', messageCount: 20 }),
      mkConv({ id: 'c', forkedFrom: 'a', messageCount: 5 }),
      mkConv({ id: 'd', forkedFrom: 'b', messageCount: 2 }),
    ]
    const tree = buildTree(convs)
    const info = getBranchInfo(tree)
    expect(info.totalBranches).toBe(4)
    expect(info.maxDepth).toBe(2)
    expect(info.mostActive).toBe('b')
  })
})

// --- compareBranches ---

describe('compareBranches', () => {
  it('finds common ancestor when branches share parent', () => {
    const convs = [
      mkConv({ id: 'root' }),
      mkConv({ id: 'left', forkedFrom: 'root', messageCount: 10, updatedAt: 3000 }),
      mkConv({ id: 'right', forkedFrom: 'root', messageCount: 7, updatedAt: 4000 }),
    ]
    const result = compareBranches(
      convs.find((c) => c.id === 'left')!,
      convs.find((c) => c.id === 'right')!,
      convs,
    )
    expect(result.commonAncestor).toBe('root')
    expect(result.messageCountDiff).toBe(3)
    expect(result.newerBranch).toBe('right')
  })

  it('returns null common ancestor when no shared parent', () => {
    const convs = [
      mkConv({ id: 'a', messageCount: 5, updatedAt: 1000 }),
      mkConv({ id: 'b', messageCount: 3, updatedAt: 2000 }),
    ]
    const result = compareBranches(convs[0], convs[1], convs)
    expect(result.commonAncestor).toBeNull()
    expect(result.newerBranch).toBe('b')
  })

  it('handles comparing same conversation', () => {
    const conv = mkConv({ id: 'x', messageCount: 10, updatedAt: 5000 })
    const result = compareBranches(conv, conv, [conv])
    expect(result.messageCountDiff).toBe(0)
    expect(result.newerBranch).toBe('x')
  })
})

// --- mergeBranches ---

describe('mergeBranches', () => {
  it('merges and deduplicates messages by id, sorted by timestamp', () => {
    const primary: ConvMeta & { messages: { id: string; content: string; role: string; ts: number }[] } = {
      ...mkConv({ id: 'p' }),
      messages: [
        { id: 'm1', content: 'Hello', role: 'user', ts: 100 },
        { id: 'm2', content: 'World', role: 'assistant', ts: 200 },
      ],
    }
    const secondary: ConvMeta & { messages: { id: string; content: string; role: string; ts: number }[] } = {
      ...mkConv({ id: 's' }),
      messages: [
        { id: 'm2', content: 'World', role: 'assistant', ts: 200 }, // duplicate
        { id: 'm3', content: 'New', role: 'user', ts: 150 },
      ],
    }
    const result = mergeBranches(primary, secondary)
    expect(result.sourceIds).toEqual(['p', 's'])
    expect(result.messages).toHaveLength(3)
    // Sorted by ts
    expect(result.messages[0].id).toBe('m1')
    expect(result.messages[1].id).toBe('m3')
    expect(result.messages[2].id).toBe('m2')
  })

  it('preserves all messages when no overlap', () => {
    const primary = {
      ...mkConv({ id: 'p' }),
      messages: [{ id: 'a', content: 'A', role: 'user', ts: 10 }],
    }
    const secondary = {
      ...mkConv({ id: 's' }),
      messages: [{ id: 'b', content: 'B', role: 'assistant', ts: 20 }],
    }
    const result = mergeBranches(primary, secondary)
    expect(result.messages).toHaveLength(2)
    expect(result.messages[0].id).toBe('a')
    expect(result.messages[1].id).toBe('b')
  })
})

// --- Helper ---

function flattenIds(nodes: TreeNode[]): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    ids.push(node.conv.id)
    ids.push(...flattenIds(node.children))
  }
  return ids
}
