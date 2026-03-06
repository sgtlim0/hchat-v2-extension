import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '../i18n'
import {
  getServers,
  registerServer,
  removeServer,
  listTools,
  testConnection,
} from '../lib/mcpClient'
import type { McpServerConfig, McpTool } from '../lib/mcpClient'

interface McpServerManagerProps {
  onClose: () => void
}

interface ConnectionStatus {
  serverId: string
  status: 'connected' | 'failed' | null
}

export function McpServerManager({ onClose }: McpServerManagerProps) {
  const { t } = useLocale()
  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [toolsMap, setToolsMap] = useState<Record<string, McpTool[]>>({})
  const [expandedServer, setExpandedServer] = useState<string | null>(null)

  const loadServers = useCallback(async () => {
    const loaded = await getServers()
    setServers(loaded)
  }, [])

  useEffect(() => {
    loadServers()
  }, [loadServers])

  const handleAddServer = useCallback(async () => {
    if (!name.trim() || !baseUrl.trim()) return

    const config: McpServerConfig = {
      id: `mcp-${Date.now()}`,
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      enabled: true,
      createdAt: Date.now(),
    }

    await registerServer(config)
    setName('')
    setBaseUrl('')
    setApiKey('')
    await loadServers()
  }, [name, baseUrl, apiKey, loadServers])

  const handleRemove = useCallback(
    async (id: string) => {
      await removeServer(id)
      await loadServers()
    },
    [loadServers],
  )

  const handleToggle = useCallback(
    async (server: McpServerConfig) => {
      const updated: McpServerConfig = { ...server, enabled: !server.enabled }
      await registerServer(updated)
      await loadServers()
    },
    [loadServers],
  )

  const handleTestConnection = useCallback(
    async (server: McpServerConfig) => {
      const ok = await testConnection(server)
      setConnectionStatus({
        serverId: server.id,
        status: ok ? 'connected' : 'failed',
      })
    },
    [],
  )

  const handleShowTools = useCallback(
    async (serverId: string) => {
      if (expandedServer === serverId) {
        setExpandedServer(null)
        return
      }

      try {
        const tools = await listTools(serverId)
        setToolsMap((prev) => ({ ...prev, [serverId]: tools }))
        setExpandedServer(serverId)
      } catch {
        setToolsMap((prev) => ({ ...prev, [serverId]: [] }))
        setExpandedServer(serverId)
      }
    },
    [expandedServer],
  )

  return (
    <div className="mcp-server-manager">
      <div className="mcp-header">
        <h3>{t('mcp.title')}</h3>
        <button className="mcp-close-btn" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>

      <div className="mcp-add-form">
        <input
          type="text"
          placeholder={t('mcp.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder={t('mcp.urlPlaceholder')}
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <input
          type="text"
          placeholder={t('mcp.apiKeyPlaceholder')}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <button className="mcp-add-btn" onClick={handleAddServer}>
          {t('mcp.addServer')}
        </button>
      </div>

      <div className="mcp-server-list">
        {servers.map((server) => (
          <div key={server.id} className="mcp-server-item">
            <div className="mcp-server-info">
              <span className="mcp-server-name">{server.name}</span>
              <span className="mcp-server-url">{server.baseUrl}</span>
              {connectionStatus?.serverId === server.id && connectionStatus.status && (
                <span
                  className={`mcp-status ${connectionStatus.status}`}
                >
                  {connectionStatus.status === 'connected'
                    ? t('mcp.connected')
                    : t('mcp.failed')}
                </span>
              )}
            </div>

            <div className="mcp-server-actions">
              <label className="mcp-toggle">
                <input
                  type="checkbox"
                  checked={server.enabled}
                  onChange={() => handleToggle(server)}
                />
                {t('mcp.enabled')}
              </label>
              <button onClick={() => handleTestConnection(server)}>
                {t('mcp.testConnection')}
              </button>
              <button onClick={() => handleShowTools(server.id)}>
                {t('mcp.tools')}
              </button>
              <button
                className="mcp-remove-btn"
                onClick={() => handleRemove(server.id)}
              >
                {t('mcp.remove')}
              </button>
            </div>

            {expandedServer === server.id && toolsMap[server.id] && (
              <div className="mcp-tools-list">
                {toolsMap[server.id].map((tool) => (
                  <div key={tool.name} className="mcp-tool-item">
                    <span className="mcp-tool-name">{tool.name}</span>
                    <span className="mcp-tool-desc">{tool.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
