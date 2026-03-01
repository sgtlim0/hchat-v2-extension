// lib/aws-sigv4.ts  –  AWS Signature V4 (Web Crypto API)

interface SignParams {
  method: string
  url: string
  headers: Record<string, string>
  body: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  service: string
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256(data: string): Promise<string> {
  const enc = new TextEncoder().encode(data)
  return toHex(await crypto.subtle.digest('SHA-256', enc))
}

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
}

async function getSigningKey(
  secretKey: string, dateStamp: string, region: string, service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + secretKey), dateStamp)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  return hmacSha256(kService, 'aws4_request')
}

function encodeCanonicalUri(pathname: string): string {
  return pathname
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

export async function signRequest(params: SignParams): Promise<Record<string, string>> {
  const { method, url, headers, body, accessKeyId, secretAccessKey, region, service } = params

  const parsedUrl = new URL(url)
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  const allHeaders: Record<string, string> = {
    ...headers,
    host: parsedUrl.host,
    'x-amz-date': amzDate,
  }

  const sortedKeys = Object.keys(allHeaders).sort()
  const canonicalHeaders = sortedKeys.map((k) => `${k.toLowerCase()}:${allHeaders[k].trim()}`).join('\n') + '\n'
  const signedHeaders = sortedKeys.map((k) => k.toLowerCase()).join(';')

  const payloadHash = await sha256(body)
  const canonicalUri = encodeCanonicalUri(parsedUrl.pathname)

  const canonicalRequest = [
    method,
    canonicalUri,
    parsedUrl.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n')

  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service)
  const signature = toHex(await hmacSha256(signingKey, stringToSign))

  return {
    ...allHeaders,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}
