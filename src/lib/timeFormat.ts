// lib/timeFormat.ts — Time formatting utilities

/**
 * Format seconds into a human-readable string
 * @param seconds - Number of seconds
 * @param locale - Locale code (ko, en, ja)
 * @returns Formatted time string (e.g., "2분 30초" or "45초")
 */
export function formatTime(seconds: number, locale: string = 'ko'): string {
  const sec = Math.round(seconds)

  if (sec < 60) {
    return locale === 'ko' ? `${sec}초` :
           locale === 'ja' ? `${sec}秒` :
           `${sec}s`
  }

  const minutes = Math.floor(sec / 60)
  const remainingSec = sec % 60

  if (remainingSec === 0) {
    return locale === 'ko' ? `${minutes}분` :
           locale === 'ja' ? `${minutes}分` :
           `${minutes}m`
  }

  return locale === 'ko' ? `${minutes}분 ${remainingSec}초` :
         locale === 'ja' ? `${minutes}分 ${remainingSec}秒` :
         `${minutes}m ${remainingSec}s`
}

/**
 * Calculate estimated remaining time based on completed chunks
 * @param completedChunks - Number of completed chunks
 * @param totalChunks - Total number of chunks
 * @param chunkTimes - Array of time taken for each chunk (in ms)
 * @returns Estimated remaining time in seconds, or null if not enough data
 */
export function calculateRemainingTime(
  completedChunks: number,
  totalChunks: number,
  chunkTimes: number[],
): number | null {
  if (completedChunks === 0 || chunkTimes.length === 0) {
    return null
  }

  // Calculate average time per chunk
  const totalTime = chunkTimes.reduce((sum, time) => sum + time, 0)
  const avgTimePerChunk = totalTime / chunkTimes.length

  // Estimate remaining time
  const remainingChunks = totalChunks - completedChunks
  const estimatedMs = avgTimePerChunk * remainingChunks

  return Math.round(estimatedMs / 1000) // Convert to seconds
}
