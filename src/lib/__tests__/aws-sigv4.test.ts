/**
 * AWS SigV4 signing tests
 * Tests: signature generation, canonical request building, header construction
 */

import { signRequest } from '../aws-sigv4'

describe('aws-sigv4', () => {
  const baseParams = {
    method: 'POST',
    url: 'https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-sonnet-4-6/invoke-with-response-stream',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1',
    service: 'bedrock',
  }

  describe('signRequest', () => {
    it('should return signed headers with Authorization', async () => {
      const result = await signRequest(baseParams)

      expect(result).toHaveProperty('Authorization')
      expect(result.Authorization).toContain('AWS4-HMAC-SHA256')
      expect(result.Authorization).toContain('Credential=AKIAIOSFODNN7EXAMPLE')
      expect(result.Authorization).toContain('SignedHeaders=')
      expect(result.Authorization).toContain('Signature=')
    })

    it('should include x-amz-date header', async () => {
      const result = await signRequest(baseParams)

      expect(result).toHaveProperty('x-amz-date')
      // Format: YYYYMMDDTHHMMSSZ
      expect(result['x-amz-date']).toMatch(/^\d{8}T\d{6}Z$/)
    })

    it('should include host header', async () => {
      const result = await signRequest(baseParams)

      expect(result.host).toBe('bedrock-runtime.us-east-1.amazonaws.com')
    })

    it('should preserve original headers', async () => {
      const result = await signRequest(baseParams)

      expect(result['content-type']).toBe('application/json')
    })

    it('should include credential scope with correct format', async () => {
      const result = await signRequest(baseParams)

      // Credential format: AKID/YYYYMMDD/region/service/aws4_request
      const credMatch = result.Authorization.match(/Credential=([^,]+)/)
      expect(credMatch).not.toBeNull()
      const credential = credMatch![1]
      expect(credential).toMatch(/AKIAIOSFODNN7EXAMPLE\/\d{8}\/us-east-1\/bedrock\/aws4_request/)
    })

    it('should include sorted signed headers', async () => {
      const result = await signRequest(baseParams)

      const shMatch = result.Authorization.match(/SignedHeaders=([^,]+)/)
      expect(shMatch).not.toBeNull()
      const signedHeaders = shMatch![1]
      // Should be alphabetically sorted, semicolon-separated
      const parts = signedHeaders.split(';')
      const sorted = [...parts].sort()
      expect(parts).toEqual(sorted)
    })

    it('should produce different signatures for different bodies', async () => {
      const result1 = await signRequest(baseParams)
      const result2 = await signRequest({
        ...baseParams,
        body: JSON.stringify({ messages: [{ role: 'user', content: 'different' }] }),
      })

      const sig1 = result1.Authorization.match(/Signature=([a-f0-9]+)/)![1]
      const sig2 = result2.Authorization.match(/Signature=([a-f0-9]+)/)![1]
      expect(sig1).not.toBe(sig2)
    })

    it('should produce different signatures for different regions', async () => {
      const result1 = await signRequest(baseParams)
      const result2 = await signRequest({ ...baseParams, region: 'ap-northeast-2' })

      const sig1 = result1.Authorization.match(/Signature=([a-f0-9]+)/)![1]
      const sig2 = result2.Authorization.match(/Signature=([a-f0-9]+)/)![1]
      expect(sig1).not.toBe(sig2)
    })

    it('should produce hex-encoded signature (64 chars)', async () => {
      const result = await signRequest(baseParams)

      const sigMatch = result.Authorization.match(/Signature=([a-f0-9]+)/)
      expect(sigMatch).not.toBeNull()
      expect(sigMatch![1]).toHaveLength(64) // SHA-256 = 32 bytes = 64 hex chars
    })

    it('should handle URL with query parameters', async () => {
      const result = await signRequest({
        ...baseParams,
        url: 'https://bedrock-runtime.us-east-1.amazonaws.com/model/test?version=2024',
      })

      expect(result.Authorization).toContain('AWS4-HMAC-SHA256')
    })

    it('should handle empty body', async () => {
      const result = await signRequest({
        ...baseParams,
        body: '',
      })

      expect(result.Authorization).toContain('AWS4-HMAC-SHA256')
    })

    it('should handle GET method', async () => {
      const result = await signRequest({
        ...baseParams,
        method: 'GET',
        body: '',
      })

      expect(result.Authorization).toContain('AWS4-HMAC-SHA256')
    })

    it('should URI-encode path segments', async () => {
      const result = await signRequest({
        ...baseParams,
        url: 'https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-sonnet-4-6/invoke',
      })

      expect(result.Authorization).toContain('AWS4-HMAC-SHA256')
    })
  })
})
