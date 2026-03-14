// providers/error-parser.ts — Unified error response parser for all providers

/**
 * Parse an HTTP error response body into a human-readable message.
 * Tries JSON first (extracting error.message), falls back to raw text.
 */
export function parseErrorMessage(status: number, body: string): string {
  let errMsg = `HTTP ${status}`
  try {
    const errJson = JSON.parse(body)
    errMsg = errJson.error?.message ?? errJson.message ?? errJson.Message ?? errMsg
  } catch {
    errMsg = body || errMsg
  }
  return errMsg
}

/**
 * Read the error response body and throw an Error with a parsed message.
 * Use in providers after checking `!res.ok`.
 */
export async function throwProviderError(res: Response): never {
  const body = await res.text()
  throw new Error(parseErrorMessage(res.status, body))
}
