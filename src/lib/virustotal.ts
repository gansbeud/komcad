interface VirusTotalStats {
  malicious: number
  suspicious: number
  undetected: number
  harmless: number
  timeout?: number
}

interface VirusTotalResult {
  type: string
  id: string
  attributes: {
    last_analysis_stats: VirusTotalStats
    last_analysis_date: number
    meaningful_name?: string
    tags?: string[]
    reputation?: number
    country?: string
    as_owner?: string
    rdap?: { name?: string }
    total_votes?: { harmless: number; malicious: number }
    crowdsourced_context?: Array<{
      timestamp: number
      details: string
      title: string
      severity: string
      source: string
    }>
  }
}

export async function checkVirusTotal(indicator: string): Promise<VirusTotalResult | null> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY
  if (!apiKey) {
    throw new Error('VIRUSTOTAL_API_KEY not configured')
  }

  try {
    // Detect indicator type
    let endpoint = ''
    let encodedIndicator = ''

    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(indicator)) {
      // IPv4
      endpoint = `https://www.virustotal.com/api/v3/ip_addresses/${indicator}`
    } else if (/^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/.test(indicator)) {
      // File hash
      endpoint = `https://www.virustotal.com/api/v3/files/${indicator}`
    } else if (/^https?:\/\/.+/.test(indicator)) {
      // URL - need to encode
      encodedIndicator = Buffer.from(indicator).toString('base64').replace(/=/g, '')
      endpoint = `https://www.virustotal.com/api/v3/urls/${encodedIndicator}`
    } else if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(indicator)) {
      // Domain or hostname
      endpoint = `https://www.virustotal.com/api/v3/domains/${indicator}`
    } else {
      return null
    }

    const response = await fetch(endpoint, {
      headers: {
        'x-apikey': apiKey
      }
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      console.error(`VirusTotal API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    return data.data || null
  } catch (error) {
    console.error('VirusTotal fetch error:', error)
    return null
  }
}

export function formatVirusTotalResult(result: VirusTotalResult | null, indicator: string) {
  if (!result) return null

  const stats = result.attributes.last_analysis_stats
  let status = 'clean'
  if (stats.malicious > 0) status = 'malicious'
  else if (stats.suspicious > 0) status = 'suspicious'

  let lastAnalysisDate: string | null = null
  if (result.attributes.last_analysis_date && typeof result.attributes.last_analysis_date === 'number') {
    try {
      lastAnalysisDate = new Date(result.attributes.last_analysis_date * 1000).toISOString()
    } catch {
      lastAnalysisDate = null
    }
  }

  const crowdsourced_context = result.attributes.crowdsourced_context?.map((ctx) => ({
    timestamp: ctx.timestamp ? new Date(ctx.timestamp * 1000).toISOString() : null,
    details: ctx.details ?? null,
    title: ctx.title ?? null,
    severity: ctx.severity ?? null,
    source: ctx.source ?? null,
  })) ?? null

  return {
    source: 'VirusTotal',
    indicator,
    status,
    id: result.id ?? null,
    last_analysis_stats: {
      malicious: stats.malicious ?? null,
      suspicious: stats.suspicious ?? null,
      undetected: stats.undetected ?? null,
      harmless: stats.harmless ?? null,
      timeout: stats.timeout ?? null,
    },
    rdap_name: result.attributes.rdap?.name ?? null,
    country: result.attributes.country ?? null,
    as_owner: result.attributes.as_owner ?? null,
    total_votes: result.attributes.total_votes ?? null,
    reputation: result.attributes.reputation ?? null,
    tags: result.attributes.tags ?? null,
    crowdsourced_context,
    last_analysis_date: lastAnalysisDate,
  }
}
