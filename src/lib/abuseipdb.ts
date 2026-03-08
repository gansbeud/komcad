interface AbuseIPDBResult {
  ipAddress: string
  isWhitelisted: boolean | null
  isTor: boolean | null
  abuseConfidenceScore: number
  countryCode: string
  countryName: string | null
  usageType: string | null
  isp: string | null
  domain: string | null
  hostnames: string[]
  totalReports: number
  numDistinctUsers: number
  lastReportedAt: string | null
}

export async function checkAbuseIPDB(indicator: string, maxAgeInDays: number = 180): Promise<AbuseIPDBResult | null> {
  const apiKey = process.env.ABUSEIPDB_API_KEY
  if (!apiKey) {
    throw new Error('ABUSEIPDB_API_KEY not configured')
  }

  // Only supports IPv4 addresses — validate each octet is 0-255
  const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/
  if (!ipv4Regex.test(indicator)) {
    return null
  }

  try {
    const params = new URLSearchParams()
    params.append('ipAddress', indicator)
    params.append('maxAgeInDays', String(maxAgeInDays))
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
    status: result.abuseConfidenceScore > 75 ? 'malicious' : result.abuseConfidenceScore > 25 ? 'suspicious' : 'clean',
    // Full detailed fields
    ipAddress: result.ipAddress ?? null,
    isWhitelisted: result.isWhitelisted ?? null,
    isTor: result.isTor ?? null,
    abuseConfidenceScore: result.abuseConfidenceScore ?? null,
    totalReports: result.totalReports ?? null,
    countryCode: result.countryCode ?? null,
    countryName: result.countryName ?? null,
    isp: result.isp ?? null,
    domain: result.domain ?? null,
    hostnames: result.hostnames ?? [],
    usageType: result.usageType ?? null,
    lastReportedAt: result.lastReportedAt ?? null,
  }
}
