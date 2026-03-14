import { describe, it, expect } from 'vitest'
import { validateExternalUrl } from '../urlValidator'

describe('validateExternalUrl', () => {
  describe('allowed URLs', () => {
    it('allows https URLs', () => {
      expect(validateExternalUrl('https://example.com')).toEqual({ valid: true })
    })

    it('allows http URLs', () => {
      expect(validateExternalUrl('http://example.com')).toEqual({ valid: true })
    })

    it('allows URLs with paths', () => {
      expect(validateExternalUrl('https://example.com/path/to/page')).toEqual({ valid: true })
    })

    it('allows URLs with query params', () => {
      expect(validateExternalUrl('https://example.com?q=test')).toEqual({ valid: true })
    })

    it('allows URLs with ports', () => {
      expect(validateExternalUrl('https://example.com:8080')).toEqual({ valid: true })
    })

    it('allows URLs with subdomains', () => {
      expect(validateExternalUrl('https://api.example.com/v1')).toEqual({ valid: true })
    })

    it('allows international domain names', () => {
      expect(validateExternalUrl('https://例え.jp')).toEqual({ valid: true })
    })
  })

  describe('blocked protocols', () => {
    it('blocks file:// protocol', () => {
      const r = validateExternalUrl('file:///etc/passwd')
      expect(r.valid).toBe(false)
      expect(r.reason).toContain('Blocked protocol')
    })

    it('blocks data: protocol', () => {
      const r = validateExternalUrl('data:text/html,<script>alert(1)</script>')
      expect(r.valid).toBe(false)
      expect(r.reason).toContain('Blocked protocol')
    })

    it('blocks javascript: protocol', () => {
      const r = validateExternalUrl('javascript:alert(1)')
      expect(r.valid).toBe(false)
    })

    it('blocks vbscript: protocol', () => {
      const r = validateExternalUrl('vbscript:msgbox')
      expect(r.valid).toBe(false)
    })

    it('blocks ftp: protocol', () => {
      const r = validateExternalUrl('ftp://files.example.com')
      expect(r.valid).toBe(false)
    })
  })

  describe('blocked internal IPs - loopback', () => {
    it('blocks 127.0.0.1', () => {
      expect(validateExternalUrl('http://127.0.0.1')).toMatchObject({ valid: false })
    })

    it('blocks 127.0.0.2', () => {
      expect(validateExternalUrl('http://127.0.0.2')).toMatchObject({ valid: false })
    })

    it('blocks 127.255.255.255', () => {
      expect(validateExternalUrl('http://127.255.255.255')).toMatchObject({ valid: false })
    })

    it('blocks localhost', () => {
      expect(validateExternalUrl('http://localhost')).toMatchObject({ valid: false })
    })

    it('blocks localhost with port', () => {
      expect(validateExternalUrl('http://localhost:3000')).toMatchObject({ valid: false })
    })

    it('blocks subdomain.localhost', () => {
      expect(validateExternalUrl('http://app.localhost')).toMatchObject({ valid: false })
    })
  })

  describe('blocked internal IPs - private ranges', () => {
    it('blocks 10.0.0.1 (10.0.0.0/8)', () => {
      expect(validateExternalUrl('http://10.0.0.1')).toMatchObject({ valid: false })
    })

    it('blocks 10.255.255.255', () => {
      expect(validateExternalUrl('http://10.255.255.255')).toMatchObject({ valid: false })
    })

    it('blocks 172.16.0.1 (172.16.0.0/12)', () => {
      expect(validateExternalUrl('http://172.16.0.1')).toMatchObject({ valid: false })
    })

    it('blocks 172.31.255.255', () => {
      expect(validateExternalUrl('http://172.31.255.255')).toMatchObject({ valid: false })
    })

    it('allows 172.32.0.1 (outside /12)', () => {
      expect(validateExternalUrl('http://172.32.0.1')).toEqual({ valid: true })
    })

    it('blocks 192.168.0.1 (192.168.0.0/16)', () => {
      expect(validateExternalUrl('http://192.168.0.1')).toMatchObject({ valid: false })
    })

    it('blocks 192.168.255.255', () => {
      expect(validateExternalUrl('http://192.168.255.255')).toMatchObject({ valid: false })
    })
  })

  describe('blocked internal IPs - link-local', () => {
    it('blocks 169.254.0.1 (link-local)', () => {
      expect(validateExternalUrl('http://169.254.0.1')).toMatchObject({ valid: false })
    })

    it('blocks 169.254.169.254 (cloud metadata)', () => {
      expect(validateExternalUrl('http://169.254.169.254')).toMatchObject({ valid: false })
    })
  })

  describe('blocked internal IPs - special', () => {
    it('blocks 0.0.0.0', () => {
      expect(validateExternalUrl('http://0.0.0.0')).toMatchObject({ valid: false })
    })
  })

  describe('blocked IPv6', () => {
    it('blocks ::1 (loopback)', () => {
      expect(validateExternalUrl('http://[::1]')).toMatchObject({ valid: false })
    })

    it('blocks fe80:: (link-local)', () => {
      expect(validateExternalUrl('http://[fe80::1]')).toMatchObject({ valid: false })
    })

    it('blocks fc00:: (unique local)', () => {
      expect(validateExternalUrl('http://[fc00::1]')).toMatchObject({ valid: false })
    })

    it('blocks fd00:: (unique local)', () => {
      expect(validateExternalUrl('http://[fd12::1]')).toMatchObject({ valid: false })
    })
  })

  describe('invalid URLs', () => {
    it('rejects empty string', () => {
      expect(validateExternalUrl('')).toMatchObject({ valid: false })
    })

    it('rejects non-URL string', () => {
      expect(validateExternalUrl('not a url')).toMatchObject({ valid: false })
    })

    it('rejects malformed URL', () => {
      expect(validateExternalUrl('http://')).toMatchObject({ valid: false })
    })
  })

  describe('edge cases', () => {
    it('blocks IPv4-mapped IPv6 loopback', () => {
      expect(validateExternalUrl('http://[::ffff:127.0.0.1]')).toMatchObject({ valid: false })
    })

    it('blocks IPv4-mapped IPv6 private', () => {
      expect(validateExternalUrl('http://[::ffff:192.168.1.1]')).toMatchObject({ valid: false })
    })

    it('allows normal public IPv4', () => {
      expect(validateExternalUrl('http://8.8.8.8')).toEqual({ valid: true })
    })

    it('allows normal public domain', () => {
      expect(validateExternalUrl('https://google.com')).toEqual({ valid: true })
    })
  })
})
