/// <reference lib="dom" />

export interface WhoisResult {
  ip: string
  hostname?: string
  city?: string
  region?: string
  country?: string
  org?: string
  timezone?: string
  loc?: string
  postal?: string
  readme?: string
  anycast?: boolean
}

export async function lookupIP(query: string, apiKey: string): Promise<WhoisResult> {
  const encoded = encodeURIComponent(query.trim())
  const url = `https://ipinfo.io/${encoded}?token=${apiKey}`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'KOMCAD/1.0' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`ipinfo.io returned ${res.status}: ${text}`)
  }
  return (await res.json()) as WhoisResult
}

export function formatWhoisResult(r: WhoisResult): string[][] {
  const rows: [string, string][] = []
  if (r.ip)       rows.push(['IP Address',  r.ip])
  if (r.hostname) rows.push(['Hostname',    r.hostname])
  if (r.org)      rows.push(['Organization', r.org])
  if (r.city || r.region || r.country) {
    rows.push(['Location', [r.city, r.region, r.country].filter(Boolean).join(', ')])
  }
  if (r.loc)      rows.push(['Coordinates', r.loc])
  if (r.postal)   rows.push(['Postal Code', r.postal])
  if (r.timezone) rows.push(['Timezone',    r.timezone])
  if (r.anycast)  rows.push(['Anycast',     'Yes'])
  return rows
}
