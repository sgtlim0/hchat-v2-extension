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
  // Fetch YouTube page and extract captions
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`)
    const html = await res.text()
    const captionsMatch = html.match(/"captionTracks":\[(.*?)\]/)
    if (!captionsMatch) return ''
    const tracks = JSON.parse('[' + captionsMatch[1] + ']')
    const track = tracks.find((t: {languageCode:string}) => t.languageCode === 'ko') ?? tracks[0]
    if (!track?.baseUrl) return ''
    const xmlRes = await fetch(track.baseUrl)
    const xml = await xmlRes.text()
    return xml
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/\n+/g, ' ')
      .trim()
      .slice(0, 6000)
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
