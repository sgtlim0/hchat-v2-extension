// conversationTree.ts — Conversation tree structure and branch management

const MAX_DEPTH = 5

export interface ConvMeta {
  id: string
  title: string
  messageCount: number
  createdAt: number
  updatedAt: number
  forkedFrom?: string
  forkMessageId?: string
}

export interface TreeNode {
  conv: ConvMeta
  children: TreeNode[]
  depth: number
}

export interface BranchInfo {
  totalBranches: number
  maxDepth: number
  mostActive: string
}

export interface BranchComparison {
  commonAncestor: string | null
  messageCountDiff: number
  newerBranch: string
}

export interface MergedConv {
  messages: { id: string; content: string; role: string; ts: number }[]
  sourceIds: string[]
}

type ConvWithMessages = ConvMeta & {
  messages: { id: string; content: string; role: string; ts: number }[]
}

/**
 * Build a tree from flat conversation list using forkedFrom relationships.
 * Children whose depth would exceed MAX_DEPTH are promoted to root level.
 */
export function buildTree(conversations: ConvMeta[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>()

  for (const conv of conversations) {
    nodeMap.set(conv.id, { conv, children: [], depth: 0 })
  }

  const roots: TreeNode[] = []

  for (const conv of conversations) {
    const node = nodeMap.get(conv.id)!

    if (!conv.forkedFrom || !nodeMap.has(conv.forkedFrom)) {
      roots.push(node)
      continue
    }

    const parent = nodeMap.get(conv.forkedFrom)!
    const childDepth = parent.depth + 1

    if (childDepth > MAX_DEPTH) {
      roots.push(node)
      continue
    }

    node.depth = childDepth
    parent.children.push(node)
    propagateDepth(node, childDepth)
  }

  return roots
}

function propagateDepth(node: TreeNode, depth: number): void {
  node.depth = depth
  for (const child of node.children) {
    propagateDepth(child, depth + 1)
  }
}

/**
 * DFS search for a node by conversation ID.
 */
export function findNode(tree: TreeNode[], convId: string): TreeNode | null {
  for (const node of tree) {
    if (node.conv.id === convId) return node
    const found = findNode(node.children, convId)
    if (found) return found
  }
  return null
}

/**
 * Return ancestor IDs from immediate parent to root.
 */
export function getAncestors(tree: TreeNode[], convId: string): string[] {
  const path: string[] = []
  findPath(tree, convId, path)
  // path is [target, parent, grandparent, ...root] — remove target, keep order
  return path.length > 0 ? path.slice(1) : []
}

function findPath(nodes: TreeNode[], targetId: string, path: string[]): boolean {
  for (const node of nodes) {
    if (node.conv.id === targetId) {
      path.push(node.conv.id)
      return true
    }
    if (findPath(node.children, targetId, path)) {
      path.push(node.conv.id)
      return true
    }
  }
  return false
}

/**
 * Return all descendant IDs of a node (not including the node itself).
 */
export function getDescendants(node: TreeNode): string[] {
  const result: string[] = []
  collectDescendants(node.children, result)
  return result
}

function collectDescendants(nodes: TreeNode[], result: string[]): void {
  for (const node of nodes) {
    result.push(node.conv.id)
    collectDescendants(node.children, result)
  }
}

/**
 * Compute branch statistics for the tree.
 */
export function getBranchInfo(tree: TreeNode[]): BranchInfo {
  if (tree.length === 0) {
    return { totalBranches: 0, maxDepth: 0, mostActive: '' }
  }

  let totalBranches = 0
  let maxDepth = 0
  let mostActive = ''
  let highestMessageCount = -1

  traverseAll(tree, (node) => {
    totalBranches++
    if (node.depth > maxDepth) maxDepth = node.depth
    if (node.conv.messageCount > highestMessageCount) {
      highestMessageCount = node.conv.messageCount
      mostActive = node.conv.id
    }
  })

  return { totalBranches, maxDepth, mostActive }
}

function traverseAll(
  nodes: TreeNode[],
  visitor: (node: TreeNode) => void,
): void {
  for (const node of nodes) {
    visitor(node)
    traverseAll(node.children, visitor)
  }
}

/**
 * Compare two branches: common ancestor, message count diff, which is newer.
 */
export function compareBranches(
  conv1: ConvMeta,
  conv2: ConvMeta,
  allConvs: ConvMeta[],
): BranchComparison {
  const ancestors1 = getAncestorChain(conv1.id, allConvs)
  const ancestors2 = getAncestorChain(conv2.id, allConvs)

  const set1 = new Set(ancestors1)
  const commonAncestor = ancestors2.find((id) => set1.has(id)) ?? null

  return {
    commonAncestor,
    messageCountDiff: Math.abs(conv1.messageCount - conv2.messageCount),
    newerBranch: conv1.updatedAt >= conv2.updatedAt ? conv1.id : conv2.id,
  }
}

function getAncestorChain(convId: string, allConvs: ConvMeta[]): string[] {
  const convMap = new Map<string, ConvMeta>()
  for (const c of allConvs) convMap.set(c.id, c)

  const chain: string[] = []
  let current = convMap.get(convId)

  while (current?.forkedFrom) {
    chain.push(current.forkedFrom)
    current = convMap.get(current.forkedFrom)
  }

  return chain
}

/**
 * Merge two branches: combine messages, deduplicate by ID, sort by timestamp.
 */
export function mergeBranches(
  primary: ConvWithMessages,
  secondary: ConvWithMessages,
): MergedConv {
  const seen = new Set<string>()
  const merged: MergedConv['messages'] = []

  for (const msg of [...primary.messages, ...secondary.messages]) {
    if (seen.has(msg.id)) continue
    seen.add(msg.id)
    merged.push({ ...msg })
  }

  merged.sort((a, b) => a.ts - b.ts)

  return {
    messages: merged,
    sourceIds: [primary.id, secondary.id],
  }
}
