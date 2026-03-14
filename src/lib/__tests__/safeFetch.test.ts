import { describe, it, expect, vi, beforeEach } from 'vitest'
import { safeFetch } from '../safeFetch'

beforeEach(() => {
  vi.restoreAllMocks()
  global.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
})

describe('safeFetch', () => {
  describe('allowed URLs', () => {
    it('allows https://example.com', async () => {
      const res = await safeFetch('https://example.com')
      expect(res.status).toBe(200)
      expect(fetch).toHaveBeenCalledWith('https://example.com', undefined)
    })

    it('allows http://example.com', async () => {
      const res = await safeFetch('http://example.com')
      expect(res.status).toBe(200)
    })

    it('allows https with path and query', async () => {
      const url = 'https://api.example.com/v1/data?key=abc'
      await safeFetch(url)
      expect(fetch).toHaveBeenCalledWith(url, undefined)
    })

    it('allows https with port', async () => {
      await safeFetch('https://example.com:8443/api')
      expect(fetch).toHaveBeenCalled()
    })
  })

  describe('blocked URLs', () => {
    it('blocks http://127.0.0.1', async () => {
      await expect(safeFetch('http://127.0.0.1')).rejects.toThrow('Blocked URL')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('blocks http://localhost', async () => {
      await expect(safeFetch('http://localhost')).rejects.toThrow('Blocked URL')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('blocks file:///etc/passwd', async () => {
      await expect(safeFetch('file:///etc/passwd')).rejects.toThrow('Blocked URL')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('blocks http://169.254.169.254 (cloud metadata)', async () => {
      await expect(safeFetch('http://169.254.169.254/latest/meta-data/')).rejects.toThrow('Blocked URL')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('blocks http://10.0.0.1 (private range)', async () => {
      await expect(safeFetch('http://10.0.0.1')).rejects.toThrow('Blocked URL')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('blocks http://192.168.1.1 (private range)', async () => {
      await expect(safeFetch('http://192.168.1.1')).rejects.toThrow('Blocked URL')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('blocks data: protocol', async () => {
      await expect(safeFetch('data:text/html,<script>alert(1)</script>')).rejects.toThrow('Blocked URL')
    })

    it('blocks javascript: protocol', async () => {
      await expect(safeFetch('javascript:alert(1)')).rejects.toThrow('Blocked URL')
    })
  })

  describe('error messages', () => {
    it('includes reason in error message', async () => {
      await expect(safeFetch('http://127.0.0.1')).rejects.toThrow(
        'Blocked URL: Blocked private/internal address: 127.0.0.1'
      )
    })

    it('includes protocol in error for blocked protocol', async () => {
      await expect(safeFetch('file:///etc/passwd')).rejects.toThrow('Blocked protocol')
    })

    it('includes reason for invalid URL', async () => {
      await expect(safeFetch('not-a-url')).rejects.toThrow('Blocked URL')
    })
  })

  describe('RequestInit passthrough', () => {
    it('passes through headers', async () => {
      const init: RequestInit = {
        headers: { Authorization: 'Bearer token123' },
      }
      await safeFetch('https://api.example.com', init)
      expect(fetch).toHaveBeenCalledWith('https://api.example.com', init)
    })

    it('passes through POST method and body', async () => {
      const init: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      }
      await safeFetch('https://api.example.com', init)
      expect(fetch).toHaveBeenCalledWith('https://api.example.com', init)
    })

    it('passes through PUT method', async () => {
      const init: RequestInit = { method: 'PUT', body: 'data' }
      await safeFetch('https://api.example.com', init)
      expect(fetch).toHaveBeenCalledWith('https://api.example.com', init)
    })

    it('passes through DELETE method', async () => {
      const init: RequestInit = { method: 'DELETE' }
      await safeFetch('https://api.example.com', init)
      expect(fetch).toHaveBeenCalledWith('https://api.example.com', init)
    })

    it('passes through signal for abort', async () => {
      const controller = new AbortController()
      const init: RequestInit = { signal: controller.signal }
      await safeFetch('https://api.example.com', init)
      expect(fetch).toHaveBeenCalledWith('https://api.example.com', init)
    })
  })

  describe('allowLocalhost option', () => {
    it('allows localhost when allowLocalhost is true', async () => {
      const res = await safeFetch('http://localhost:11434/api/tags', undefined, { allowLocalhost: true })
      expect(res.status).toBe(200)
      expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags', undefined)
    })

    it('allows 127.0.0.1 when allowLocalhost is true', async () => {
      await safeFetch('http://127.0.0.1:11434/api/chat', undefined, { allowLocalhost: true })
      expect(fetch).toHaveBeenCalled()
    })

    it('still blocks cloud metadata even with allowLocalhost', async () => {
      await expect(
        safeFetch('http://169.254.169.254/latest/meta-data/', undefined, { allowLocalhost: true })
      ).rejects.toThrow('Blocked URL')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('still blocks private ranges (10.x) even with allowLocalhost', async () => {
      await expect(
        safeFetch('http://10.0.0.1', undefined, { allowLocalhost: true })
      ).rejects.toThrow('Blocked URL')
    })

    it('still blocks private ranges (192.168.x) even with allowLocalhost', async () => {
      await expect(
        safeFetch('http://192.168.1.1', undefined, { allowLocalhost: true })
      ).rejects.toThrow('Blocked URL')
    })

    it('still blocks file:// even with allowLocalhost', async () => {
      await expect(
        safeFetch('file:///etc/passwd', undefined, { allowLocalhost: true })
      ).rejects.toThrow('Blocked URL')
    })

    it('blocks localhost when allowLocalhost is false (default)', async () => {
      await expect(safeFetch('http://localhost:11434')).rejects.toThrow('Blocked URL')
    })
  })
})
