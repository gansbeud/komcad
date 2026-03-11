import { Hono } from 'hono'
import { checkAbuseIPDB, formatAbuseIPDBResult } from '../lib/abuseipdb'
import { checkVirusTotal, formatVirusTotalResult } from '../lib/virustotal'
import { checkOTX, formatOTXResult } from '../lib/otx'
import { sendReportEmail, type MailerEnv } from '../lib/mailer'

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

// ── POST /contact — public contact form (landing page & app report modal) ──
api.post('/contact', async (c) => {
  try {
    const fd      = await c.req.formData()
    const name    = String(fd.get('name') ?? '').trim().slice(0, 200)
    const email   = String(fd.get('email') ?? '').trim().slice(0, 200)
    const message = String(fd.get('message') ?? '').trim().slice(0, 4000)

    if (!name || !email || !message) {
      return c.json({ success: false, message: 'All fields are required.' }, 400)
    }
    // Basic email format guard
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ success: false, message: 'Invalid email address.' }, 400)
    }

    const env = c.env as MailerEnv
    await sendReportEmail(env, name, email, message)
    return c.json({ success: true, message: 'Message sent! Thank you.' })
  } catch (err) {
    console.error('Contact email error:', err)
    return c.json({ success: false, message: err instanceof Error ? err.message : 'Failed to send message.' }, 500)
  }
})

// Keep legacy /report alias for the in-app report modal
api.post('/report', async (c) => {
  try {
    const fd      = await c.req.formData()
    const name    = String(fd.get('name') ?? '').trim().slice(0, 200)
    const email   = String(fd.get('email') ?? '').trim().slice(0, 200)
    const message = String(fd.get('message') ?? '').trim().slice(0, 4000)

    if (!name || !email || !message) {
      return c.json({ success: false, message: 'All fields are required.' }, 400)
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ success: false, message: 'Invalid email address.' }, 400)
    }

    const env = c.env as MailerEnv
    await sendReportEmail(env, name, email, message)
    return c.json({ success: true, message: 'Message sent! Thank you.' })
  } catch (err) {
    console.error('Report email error:', err)
    return c.json({ success: false, message: err instanceof Error ? err.message : 'Failed to send message.' }, 500)
  }
})

export default api
