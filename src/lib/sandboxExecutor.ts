// lib/sandboxExecutor.ts — Execute user JavaScript safely in a sandboxed iframe
// Uses Chrome MV3 sandbox page (sandbox.html) which can run eval/new Function
// while being isolated from the extension's origin (no chrome.* API access).

let sandboxFrame: HTMLIFrameElement | null = null
let sandboxReady = false
const pendingRequests = new Map<string, { resolve: (v: string) => void; timer: ReturnType<typeof setTimeout> }>()

function getSandboxFrame(): HTMLIFrameElement {
  if (sandboxFrame && document.body.contains(sandboxFrame)) return sandboxFrame

  sandboxFrame = document.createElement('iframe')
  sandboxFrame.src = chrome.runtime.getURL('sandbox.html')
  sandboxFrame.style.display = 'none'
  document.body.appendChild(sandboxFrame)
  sandboxReady = false

  sandboxFrame.addEventListener('load', () => { sandboxReady = true })

  return sandboxFrame
}

function handleSandboxMessage(event: MessageEvent) {
  const { id, result, error } = event.data ?? {}
  if (!id || !pendingRequests.has(id)) return

  const pending = pendingRequests.get(id)!
  pendingRequests.delete(id)
  clearTimeout(pending.timer)
  pending.resolve(error ?? result ?? '')
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', handleSandboxMessage)
}

const TIMEOUT_MS = 5000

export function executeSandboxCode(code: string, input: string): Promise<string> {
  return new Promise((resolve) => {
    const frame = getSandboxFrame()
    const id = `sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    const timer = setTimeout(() => {
      pendingRequests.delete(id)
      resolve('JavaScript error: Execution timed out (5s)')
    }, TIMEOUT_MS)

    pendingRequests.set(id, { resolve, timer })

    const sendMessage = () => {
      frame.contentWindow?.postMessage({ id, code, input }, '*')
    }

    if (sandboxReady) {
      sendMessage()
    } else {
      frame.addEventListener('load', sendMessage, { once: true })
    }
  })
}
