// lib/pageReader.ts  –  현재 탭 내용 추출

export interface PageContent {
  url: string
  title: string
  text: string
  isYouTube: boolean
  youtubeId?: string
}

export async function getCurrentPageContent(): Promise<PageContent> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url) throw new Error('활성 탭을 찾을 수 없습니다')

  const url = tab.url
  const title = tab.title ?? ''
  const isYouTube = url.includes('youtube.com/watch')
  const youtubeId = isYouTube ? new URL(url).searchParams.get('v') ?? undefined : undefined

  // Inject content extractor
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Remove scripts, styles, nav, ads
      const clone = document.cloneNode(true) as Document
      clone.querySelectorAll('script,style,nav,header,footer,aside,[class*="ad"],[id*="ad"]').forEach((e) => e.remove())
      const main = clone.querySelector('main, article, [role="main"]') ?? clone.body
      return (main?.innerText ?? '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 8000)
    },
  })

  const text = results?.[0]?.result ?? ''
  return { url, title, text, isYouTube, youtubeId }
}

export async function getYouTubeTranscript(videoId: string): Promise<string> {
  // Extract captions from the YouTube tab via executeScript
  // This avoids CORS issues and bot detection by reading from the already-loaded page
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return ''

    // Step 1: Extract caption track URL from YouTube's player data
    // Must use MAIN world to access page-level JS variables like ytInitialPlayerResponse
    const captionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN' as any,
      func: (preferLang: string) => {
        try {
          // Method 1: Global variable (most reliable, works on initial load)
          const playerResp = (window as any).ytInitialPlayerResponse
          if (playerResp) {
            const tracks = playerResp?.captions?.playerCaptionsTracklistRenderer?.captionTracks
            if (tracks?.length) {
              const track = tracks.find((t: { languageCode: string }) => t.languageCode === preferLang) ?? tracks[0]
              if (track?.baseUrl) return track.baseUrl
            }
          }

          // Method 2: ytplayer.config (works after SPA navigation)
          const ytplayer = (window as any).ytplayer?.config?.args
          if (ytplayer) {
            const raw = ytplayer.raw_player_response ?? ytplayer.player_response
            const data = typeof raw === 'string' ? JSON.parse(raw) : raw
            const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
            if (tracks?.length) {
              const track = tracks.find((t: { languageCode: string }) => t.languageCode === preferLang) ?? tracks[0]
              if (track?.baseUrl) return track.baseUrl
            }
          }

          // Method 3: Search in page source (fallback)
          const html = document.documentElement.innerHTML
          const captionsMatch = html.match(/"captionTracks":(\[.*?\])/)
          if (captionsMatch) {
            const tracks = JSON.parse(captionsMatch[1])
            const track = tracks.find((t: { languageCode: string }) => t.languageCode === preferLang) ?? tracks[0]
            if (track?.baseUrl) return track.baseUrl
          }

          return null
        } catch {
          return null
        }
      },
      args: ['ko'],
    })

    const captionUrl = captionResults?.[0]?.result
    if (!captionUrl) return ''

    // Step 2: Fetch the caption XML from the YouTube tab (same origin, no CORS)
    const xmlResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (url: string) => {
        try {
          const res = await fetch(url)
          return await res.text()
        } catch {
          return ''
        }
      },
      args: [captionUrl],
    })

    const xml = xmlResults?.[0]?.result ?? ''
    if (!xml) return ''

    return xml
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\n+/g, ' ')
      .trim()
      .slice(0, 8000)
  } catch {
    return ''
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export function truncate(text: string, maxChars = 6000): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + `\n\n...(${text.length - maxChars}자 생략)`
}
