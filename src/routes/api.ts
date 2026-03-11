import { Hono } from 'hono'
import { checkAbuseIPDB, formatAbuseIPDBResult } from '../lib/abuseipdb'
import { checkVirusTotal, formatVirusTotalResult } from '../lib/virustotal'
import { checkOTX, formatOTXResult } from '../lib/otx'

const api = new Hono()

interface CheckRequest {
  indicators: string[]
  source: string
  mode: string
}

interface CheckResult {
  indicator: string
  source: string
  result: unknown
  error?: string
}

api.post('/check', async (c) => {
  try {
    const body = (await c.req.json()) as CheckRequest
    const { indicators, source, mode } = body

    if (!indicators || indicators.length === 0) {
      return c.json({ error: 'No indicators provided' }, 400)
    }

    if (!source) {
      return c.json({ error: 'No source selected' }, 400)
    }

    // Only available sources for now
    const availableSources = ['AbuseIPDB', 'VirusTotal', 'OTX Alienvault']
    if (!availableSources.includes(source)) {
      return c.json({ error: `Source ${source} not available yet` }, 400)
    }

    // Pre-filter empty lines so total_indicators reflects actual work done
    const validIndicators = indicators.map((i) => i.trim()).filter((i) => i.length > 0)
    const results: CheckResult[] = []

    for (const trimmedIndicator of validIndicators) {

      try {
        let result = null

        switch (source) {
          case 'AbuseIPDB': {
            const abuseResult = await checkAbuseIPDB(trimmedIndicator)
            result = formatAbuseIPDBResult(abuseResult)
            break
          }
          case 'VirusTotal': {
            const vtResult = await checkVirusTotal(trimmedIndicator)
            result = formatVirusTotalResult(vtResult, trimmedIndicator)
            break
          }
          case 'OTX Alienvault': {
            const otxResult = await checkOTX(trimmedIndicator)
            result = formatOTXResult(otxResult, trimmedIndicator)
            break
          }
        }

        results.push({
          indicator: trimmedIndicator,
          source: source,
          result: result
        })
      } catch (error) {
        results.push({
          indicator: trimmedIndicator,
          source: source,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return c.json({
      mode: mode,
      source: source,
      total_indicators: results.length,
      results: results
    })
  } catch (error) {
    console.error('API Error:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    )
  }
})

export default api
