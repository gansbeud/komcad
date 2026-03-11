/// <reference lib="dom" />

export interface NewsItem {
  title: string
  url: string
  source: string
  sourceIcon: string
  publishedAt: string // ISO string
  description: string
  threatLevel: 'Critical' | 'High' | 'Medium' | 'Info'
}

const SOURCES = [
  {
    name: 'The Hacker News',
    icon: '🔐',
    url: 'https://feeds.feedburner.com/TheHackersNews',
  },
  {
    name: 'BleepingComputer',
    icon: '💻',
    url: 'https://www.bleepingcomputer.com/feed/',
  },
  {
    name: 'Dark Reading',
    icon: '🕵️',
    url: 'https://www.darkreading.com/rss.xml',
  },
  {
    name: 'Krebs on Security',
    icon: '🔒',
    url: 'https://krebsonsecurity.com/feed/',
  },
  {
    name: 'SANS ISC',
    icon: '📡',
    url: 'https://isc.sans.edu/rssfeed_full.xml',
  },
] as const

// ── RSS XML helpers ──────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  // CDATA content
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i')
  const cdataMatch = cdataRe.exec(xml)
  if (cdataMatch) return cdataMatch[1].trim()

  // Plain text content (strip inner tags)
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const plainMatch = plainRe.exec(xml)
  if (plainMatch) return plainMatch[1].replace(/<[^>]+>/g, '').trim()

  return ''
}

function extractItems(xml: string): Array<{
  title: string
  link: string
  pubDate: string
  description: string
}> {
  const items: Array<{
    title: string
    link: string
    pubDate: string
    description: string
  }> = []

  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null

  while ((match = itemRe.exec(xml)) !== null) {
    const chunk = match[1]
    items.push({
      title: extractTag(chunk, 'title'),
      link: extractTag(chunk, 'link') || extractTag(chunk, 'guid'),
      pubDate: extractTag(chunk, 'pubDate') || extractTag(chunk, 'dc:date') || '',
      description:
        extractTag(chunk, 'description') ||
        extractTag(chunk, 'summary') ||
        extractTag(chunk, 'content:encoded') ||
        '',
    })
  }
  return items
}

// ── Threat classification ────────────────────────────────────────────────────

const CRITICAL_KW = [
  'ransomware', 'zero-day', '0-day', 'rce', 'remote code execution',
  'critical vulnerability', 'data breach', 'nation-state', 'supply chain attack',
  'apt ', 'zero day', 'actively exploited', 'mass exploitation', 'wormable',
]
const HIGH_KW = [
  'malware', 'exploit', 'vulnerability', 'cve-', 'phishing', 'backdoor',
  'trojan', 'botnet', 'rootkit', 'keylogger', 'attack', 'breach', 'hacked',
  'stolen', 'compromised', 'credential', 'exfiltration', 'spyware', 'ddos',
]
const MEDIUM_KW = [
  'patch', 'update', 'advisory', 'warning', 'risk', 'flaw', 'bug', 'leak',
  'mitigation', 'exposure', 'misconfiguration', 'scanning',
]

function classifyThreat(text: string): 'Critical' | 'High' | 'Medium' | 'Info' {
  const t = text.toLowerCase()
  if (CRITICAL_KW.some((k) => t.includes(k))) return 'Critical'
  if (HIGH_KW.some((k) => t.includes(k))) return 'High'
  if (MEDIUM_KW.some((k) => t.includes(k))) return 'Medium'
  return 'Info'
}

// ── Text helpers ─────────────────────────────────────────────────────────────

function truncateSentences(text: string, max = 3): string {
  // Strip HTML tags and normalise whitespace
  const clean = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean]
  const result = sentences.slice(0, max).join(' ').trim()
  // Hard-cap at 300 chars
  return result.length > 600 ? result.slice(0, 597) + '…' : result
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function fetchAllNews(): Promise<NewsItem[]> {
  const settled = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CyberNewsAggregator/1.0)' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${source.name}`)
      const xml = await res.text()
      const rawItems = extractItems(xml).slice(0, 8) // max 8 per source

      return rawItems.map<NewsItem>((item) => {
        const combined = item.title + ' ' + item.description
        let isoDate = ''
        try {
          isoDate = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
        } catch {
          isoDate = new Date().toISOString()
        }
        return {
          title: item.title || 'Untitled',
          url: item.link || '#',
          source: source.name,
          sourceIcon: source.icon,
          publishedAt: isoDate,
          description: truncateSentences(item.description, 5) || 'No summary available.',
          threatLevel: classifyThreat(combined),
        }
      })
    })
  )

  const all: NewsItem[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  // Newest first
  all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  return all
}
