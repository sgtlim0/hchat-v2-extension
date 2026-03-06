// ConversationTreeView.tsx — Tree visualization of conversation branches

import { useMemo } from 'react'
import { useLocale } from '../i18n'
import { buildTree, getBranchInfo } from '../lib/conversationTree'
import type { ConvMeta, TreeNode } from '../lib/conversationTree'

interface ConversationTreeViewProps {
  conversations: ConvMeta[]
  onSelectConv: (id: string) => void
  onClose: () => void
}

interface TreeNodeItemProps {
  node: TreeNode
  onSelect: (id: string) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

function TreeNodeItem({ node, onSelect, t }: TreeNodeItemProps) {
  const hasChildren = node.children.length > 0

  return (
    <>
      <div
        className="tree-node"
        style={{ paddingLeft: `${node.depth * 20}px` }}
        onClick={() => onSelect(node.conv.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(node.conv.id)
          }
        }}
        aria-label={`${t('tree.select')}: ${node.conv.title}`}
      >
        <div className="tree-node-header">
          {hasChildren && <span className="tree-branch-icon">&#9654;</span>}
          <span className="tree-node-title">{node.conv.title}</span>
        </div>
        <div className="tree-node-meta">
          <span className="tree-node-messages">
            {node.conv.messageCount} {t('tree.messages')}
          </span>
          {node.conv.forkedFrom && (
            <span className="tree-node-forked">{t('tree.forkedFrom')}</span>
          )}
        </div>
      </div>
      {node.children.map((child) => (
        <TreeNodeItem key={child.conv.id} node={child} onSelect={onSelect} t={t} />
      ))}
    </>
  )
}

export function ConversationTreeView({
  conversations,
  onSelectConv,
  onClose,
}: ConversationTreeViewProps) {
  const { t } = useLocale()

  const tree = useMemo(() => buildTree(conversations), [conversations])
  const branchInfo = useMemo(() => getBranchInfo(tree), [tree])

  const isEmpty = branchInfo.totalBranches === 0

  return (
    <div className="conversation-tree-view">
      <div className="tree-header">
        <h3 className="tree-title">{t('tree.title')}</h3>
        <button className="tree-close-btn" onClick={onClose} type="button">
          {t('tree.close')}
        </button>
      </div>

      {isEmpty ? (
        <div className="tree-empty">{t('tree.noForks')}</div>
      ) : (
        <>
          <div className="tree-branch-info">
            <span>
              {branchInfo.totalBranches} {t('tree.branches')}
            </span>
            <span>
              {t('tree.maxDepth')}: {branchInfo.maxDepth}
            </span>
          </div>

          <div className="tree-nodes">
            {tree.map((rootNode) => (
              <TreeNodeItem
                key={rootNode.conv.id}
                node={rootNode}
                onSelect={onSelectConv}
                t={t}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
