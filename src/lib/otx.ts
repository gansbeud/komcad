interface OTXIndicatorResult {
  general: {
    whitelisted: boolean
    type_title: string
    indicator: string
  }
  pulse_info: {
    count: number
    pulses: Array<{
      id: string
      name: string
      malware_families?: string[]
      attack_ids?: Array<{ id: string; title: string }>
    }>
  }
  reputation: number
}

export async function checkOTX(indicator: string): Promise<OTXIndicatorResult | null> {
  const apiKey = process.env.OTX_API_KEY
  if (!apiKey) {
    throw new Error('OTX_API_KEY not configured')
  }

  try {
    // Detect indicator type
    let endpoint = ''

    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(indicator)) {
      // IPv4
      endpoint = `https://otx.alienvault.com/api/v1/indicators/IPv4/${indicator}/general`
    } else if (/^[a-fA-F0-9:]+$/.test(indicator) && indicator.includes(':')) {
      // IPv6
      endpoint = `https://otx.alienvault.com/api/v1/indicators/IPv6/${indicator}/general`
    } else if (/^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/.test(indicator)) {
      // File hash
      endpoint = `https://otx.alienvault.com/api/v1/indicators/file/${indicator}/general`
    } else if (/^https?:\/\/.+/.test(indicator)) {
      // URL - need to encode
      const encodedUrl = encodeURIComponent(indicator)
      endpoint = `https://otx.alienvault.com/api/v1/indicators/url/${encodedUrl}/general`
    } else if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(indicator)) {
      // Domain or hostname
      endpoint = `https://otx.alienvault.com/api/v1/indicators/domain/${indicator}/general`
    } else {
      return null
    }

    const response = await fetch(endpoint, {
      headers: {
        'X-OTX-API-KEY': apiKey
      }
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      console.error(`OTX API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    return data || null
  } catch (error) {
    console.error('OTX fetch error:', error)
    return null
  }
}

export function formatOTXResult(result: OTXIndicatorResult | null, indicator: string) {
  if (!result) return null

  const pulseCount = result.pulse_info?.count || 0
  const reputation = result.reputation || 0
  const whitelisted = result.general?.whitelisted || false

  let status = 'clean'
  if (pulseCount > 5) status = 'malicious'
  else if (pulseCount > 0) status = 'suspicious'
  if (whitelisted) status = 'clean'

  const pulses = (result.pulse_info?.pulses || []).slice(0, 5).map(p => ({
    id: p.id,
    name: p.name,
    malware_families: p.malware_families || [],
    attack_ids: p.attack_ids || []
  }))

  return {
    source: 'OTX Alienvault',
    indicator: indicator,
    type: result.general?.type_title || 'Unknown',
    status: status,
    whitelisted: whitelisted,
    reputation: reputation,
    pulse_count: pulseCount,
    pulses: pulses,
    pulse_ids: result.pulse_info?.pulses?.map(p => p.id) || []
  }
}
