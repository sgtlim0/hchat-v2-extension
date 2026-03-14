// lib/urlValidator.ts — URL validation for SSRF protection

interface ValidationResult {
  valid: boolean
  reason?: string
}

const BLOCKED_PROTOCOLS = new Set(['file:', 'data:', 'javascript:', 'vbscript:', 'ftp:'])

/** Check if a hostname is a private/internal IP address */
function isPrivateHost(hostname: string): boolean {
  // Remove IPv6 brackets
  const h = hostname.replace(/^\[|\]$/g, '')

  // IPv6 loopback
  if (h === '::1' || h === '0:0:0:0:0:0:0:1') return true

  // IPv4 loopback: 127.0.0.0/8
  if (/^127\./.test(h)) return true

  // IPv4 private: 10.0.0.0/8
  if (/^10\./.test(h)) return true

  // IPv4 private: 172.16.0.0/12
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true

  // IPv4 private: 192.168.0.0/16
  if (/^192\.168\./.test(h)) return true

  // IPv4 link-local: 169.254.0.0/16
  if (/^169\.254\./.test(h)) return true

  // IPv4 zero address
  if (h === '0.0.0.0') return true

  // localhost
  if (h === 'localhost' || h.endsWith('.localhost')) return true

  // IPv6 private ranges (fe80::, fc00::, fd00::)
  if (/^(fe80|fc00|fd[0-9a-f]{2})::/i.test(h)) return true

  // IPv4-mapped IPv6 dotted form (::ffff:127.0.0.1)
  const v4mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (v4mapped) return isPrivateHost(v4mapped[1])

  // IPv4-mapped IPv6 hex form (::ffff:7f00:1 = 127.0.0.1)
  // URL parser normalizes ::ffff:127.0.0.1 → ::ffff:7f00:1
  const v4hex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (v4hex) {
    const hi = parseInt(v4hex[1], 16)
    const lo = parseInt(v4hex[2], 16)
    const ip = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
    return isPrivateHost(ip)
  }

  return false
}

/**
 * Validate a URL for external access. Blocks internal IPs and unsafe protocols.
 * Use before any fetch() call where the URL comes from untrusted input (AI, user plugins).
 */
export function validateExternalUrl(url: string): ValidationResult {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { valid: false, reason: 'Invalid URL format' }
  }

  // Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    if (BLOCKED_PROTOCOLS.has(parsed.protocol)) {
      return { valid: false, reason: `Blocked protocol: ${parsed.protocol}` }
    }
    return { valid: false, reason: `Only http/https allowed, got: ${parsed.protocol}` }
  }

  // Hostname check
  if (!parsed.hostname) {
    return { valid: false, reason: 'Missing hostname' }
  }

  if (isPrivateHost(parsed.hostname)) {
    return { valid: false, reason: `Blocked private/internal address: ${parsed.hostname}` }
  }

  return { valid: true }
}
