interface VirusTotalStats {
  malicious: number
  suspicious: number
  undetected: number
  harmless: number
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
  const totalDetections = stats.malicious + stats.suspicious + stats.undetected + stats.harmless
  const detectionRatio = totalDetections > 0 ? ((stats.malicious + stats.suspicious) / totalDetections) * 100 : 0

  let status = 'clean'
  if (stats.malicious > 0) status = 'malicious'
  else if (stats.suspicious > 0) status = 'suspicious'

  // Safe date handling - check if last_analysis_date exists and is valid
  let lastAnalysisDate = 'N/A'
  if (result.attributes.last_analysis_date && typeof result.attributes.last_analysis_date === 'number') {
    try {
      lastAnalysisDate = new Date(result.attributes.last_analysis_date * 1000).toISOString()
    } catch (error) {
      console.error('Error parsing VirusTotal date:', error)
      lastAnalysisDate = 'N/A'
    }
  }

  return {
    source: 'VirusTotal',
    indicator: indicator,
    type: result.type,
    status: status,
    malicious: stats.malicious,
    suspicious: stats.suspicious,
    undetected: stats.undetected,
    harmless: stats.harmless,
    detection_ratio: detectionRatio.toFixed(2),
    last_analysis_date: lastAnalysisDate,
    reputation: result.attributes.reputation || 0,
    tags: result.attributes.tags || []
  }
}
