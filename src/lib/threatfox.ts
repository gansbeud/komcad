interface ThreatFoxMatch {
  id: string
  ioc: string
  threat_type: string
  threat_type_desc: string
  ioc_type: string
  ioc_type_desc: string
  malware: string
  malware_printable: string
  malware_alias: string | null
  malware_malpedia: string | null
  confidence_level: number
  first_seen: string | null
  last_seen: string | null
  reference: string | null
  reporter: string
  tags: string[] | null
  malware_samples?: Array<{
    time_stamp: string
    md5_hash: string
    sha256_hash: string
    malware_bazaar: string
  }>
}

interface ThreatFoxResponse {
  query_status: string
  data: ThreatFoxMatch[] | null
}

export async function checkThreatFox(indicator: string, env?: any): Promise<ThreatFoxResponse | null> {
  // Check c.env (Cloudflare) first, then process.env (local development)
  const apiKey = env?.THREATFOX_API_KEY ?? process.env.THREATFOX_API_KEY

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['Auth-Key'] = apiKey
    }

    const response = await fetch('https://threatfox-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: 'search_ioc',
        search_term: indicator,
        exact_match: false,
      }),
    })

    if (!response.ok) {
      let errMsg = `ThreatFOX API error: ${response.status}`
      try {
        const errBody = await response.json() as Record<string, unknown>
        if (errBody?.error) errMsg += ` — ${errBody.error}`
      } catch { /* ignore parse error */ }
      throw new Error(errMsg)
    }

    const data = await response.json() as ThreatFoxResponse
    return data || null
  } catch (error) {
    console.error('ThreatFox fetch error:', error)
    return null
  }
}

export function formatThreatFoxResult(result: ThreatFoxResponse | null, indicator: string) {
  if (!result) return null

  if (result.query_status === 'no_result' || !result.data || result.data.length === 0) {
    return {
      source: 'ThreatFOX',
      indicator,
      status: 'clean',
      found: false,
      matches: [] as ReturnType<typeof buildMatch>[],
      top_threat_type: null as string | null,
      top_malware: null as string | null,
      confidence_level: null as number | null,
      first_seen: null as string | null,
      last_seen: null as string | null,
    }
  }

  const matches = result.data
  const topMatch = matches[0]
  const maxConfidence = Math.max(...matches.map((m) => m.confidence_level))

  let status = 'clean'
  if (maxConfidence >= 75) status = 'malicious'
  else if (maxConfidence >= 30) status = 'suspicious'

  function buildMatch(m: ThreatFoxMatch) {
    return {
      ioc: m.ioc,
      threat_type: m.threat_type,
      malware: m.malware_printable,
      confidence: m.confidence_level,
      first_seen: m.first_seen,
      tags: m.tags,
    }
  }

  return {
    source: 'ThreatFOX',
    indicator,
    status,
    found: true,
    matches: matches.slice(0, 3).map(buildMatch),
    top_threat_type: topMatch.threat_type,
    top_malware: topMatch.malware_printable,
    confidence_level: maxConfidence,
    first_seen: topMatch.first_seen,
    last_seen: topMatch.last_seen ?? null,
  }
}
