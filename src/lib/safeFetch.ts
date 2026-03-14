// lib/safeFetch.ts — Fetch wrapper with SSRF protection via URL validation

import { validateExternalUrl } from './urlValidator'

export interface SafeFetchOptions {
  /** Allow localhost/127.x.x.x (for local services like Ollama). Still blocks cloud metadata, private ranges, etc. */
  allowLocalhost?: boolean
}

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0:0:0:0:0:0:0:1'])

function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const h = parsed.hostname.replace(/^\[|\]$/g, '')
    return LOCALHOST_HOSTS.has(h) || h.endsWith('.localhost') || /^127\./.test(h)
  } catch {
    return false
  }
}

/**
 * Fetch wrapper that validates URLs against SSRF before making requests.
 * Use for ALL fetch calls where the URL comes from untrusted input.
 */
export async function safeFetch(
  url: string,
  init?: RequestInit,
  options?: SafeFetchOptions,
): Promise<Response> {
  if (options?.allowLocalhost && isLocalhostUrl(url)) {
    return fetch(url, init)
  }

  const validation = validateExternalUrl(url)
  if (!validation.valid) {
    throw new Error(`Blocked URL: ${validation.reason}`)
  }
  return fetch(url, init)
}
