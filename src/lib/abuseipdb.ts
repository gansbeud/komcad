interface AbuseIPDBResult {
  ipAddress: string
  abuseConfidenceScore: number
  countryCode: string
  usageType: string
  isp: string
  domain: string
  hostnames: string[]
  totalReports: number
  numDistinctUsers: number
  lastReportedAt: string
}

export async function checkAbuseIPDB(indicator: string): Promise<AbuseIPDBResult | null> {
  const apiKey = process.env.ABUSEIPDB_API_KEY
  if (!apiKey) {
    throw new Error('ABUSEIPDB_API_KEY not configured')
  }

  // Only supports IPv4 addresses
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipv4Regex.test(indicator)) {
    return null
  }

  try {
    const params = new URLSearchParams()
    params.append('ipAddress', indicator)
    params.append('maxAgeInDays', '90')
    params.append('verbose', '1')

    const response = await fetch(`https://api.abuseipdb.com/api/v2/check?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Key': apiKey,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`AbuseIPDB API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    return data.data || null
  } catch (error) {
    console.error('AbuseIPDB fetch error:', error)
    return null
  }
}

export function formatAbuseIPDBResult(result: AbuseIPDBResult | null) {
  if (!result) return null
  return {
    source: 'AbuseIPDB',
    indicator: result.ipAddress,
    risk_score: result.abuseConfidenceScore,
    status: result.abuseConfidenceScore > 75 ? 'malicious' : result.abuseConfidenceScore > 25 ? 'suspicious' : 'clean',
    reports: result.totalReports,
    distinct_users: result.numDistinctUsers,
    last_reported: result.lastReportedAt,
    country: result.countryCode,
    isp: result.isp,
    domain: result.domain
  }
}
