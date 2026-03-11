import { Hono } from 'hono'
import { checkAbuseIPDB, formatAbuseIPDBResult } from '../lib/abuseipdb'
import { checkVirusTotal, formatVirusTotalResult } from '../lib/virustotal'
import { checkOTX, formatOTXResult } from '../lib/otx'
import { checkThreatFox, formatThreatFoxResult } from '../lib/threatfox'
import { logCheckEvents } from '../lib/checklog'

const intelligence = new Hono()

// POST /api/check — returns an HTML fragment injected into #resultsArea
intelligence.post('/api/check', async (c) => {
  try {
    const formData = await c.req.formData()
    const rawInput = String(formData.get('indicators') ?? '')

    // Input length guard (prevents oversized payloads)
    if (rawInput.length > 50000) {
      return c.html(
        <div class="alert alert-error alert-soft">
          <span>Input too large (max 50,000 characters). Please reduce your input.</span>
        </div>
      )
    }

    const indicators = rawInput
      .split('\n')
      .map((i) => i.trim())
      .filter((i) => i.length > 0)

    // Individual indicator length guard
    const overlongIdx = indicators.findIndex((ind) => ind.length > 500)
    if (overlongIdx !== -1) {
      return c.html(
        <div class="alert alert-error alert-soft">
          <span>Indicator #{overlongIdx + 1} exceeds the 500-character limit. Please shorten it.</span>
        </div>
      )
    }

    const mode = String(formData.get('mode') || 'Single Mode')
    const maxAgeInDays = Math.max(1, Math.min(365, parseInt(String(formData.get('maxAgeInDays') || '180'), 10) || 180))
    const isCombined = mode === 'Combined Analysis'

    if (indicators.length === 0) {
      return c.html(
        <div class="alert alert-warning alert-soft">
          <span>Please enter at least one indicator</span>
        </div>
      )
    }

    // Combined Analysis: cap at 10 indicators
    if (isCombined && indicators.length > 10) {
      return c.html(
        <div class="alert alert-warning alert-soft">
          <span>Combined Analysis is limited to 10 indicators. You submitted {indicators.length}. Please reduce your input.</span>
        </div>
      )
    }

    // For combined mode, read checkbox sources[]; otherwise single radio source
    const availableSources = ['AbuseIPDB', 'VirusTotal', 'OTX Alienvault', 'ThreatFOX']
    let source = ''
    let combinedSources: string[] = []

    if (isCombined) {
      combinedSources = formData.getAll('sources').map(String).filter((s: string) => availableSources.includes(s))
      if (combinedSources.length === 0) combinedSources = ['AbuseIPDB', 'VirusTotal', 'OTX Alienvault', 'ThreatFOX']
      source = combinedSources.join(', ')
    } else {
      source = String(formData.get('source') || 'AbuseIPDB')
      if (!availableSources.includes(source)) {
        return c.html(
          <div class="alert alert-error alert-soft">
            <span>Source {source} is not available yet</span>
          </div>
        )
      }
    }

    // Demo account rate limits (configurable via env)
    const _reqUsername = (c as any).get?.('username') as string ?? 'unknown'
    const demoUser = process.env.DEMO_USER ?? 'demo'
    if (_reqUsername === demoUser) {
      const bulkMax = parseInt(process.env.DEMO_RATE_BULK_MAX ?? '5', 10)
      const combinedMax = parseInt(process.env.DEMO_RATE_COMBINED_MAX ?? '2', 10)
      if (!isCombined && indicators.length > bulkMax) {
        return c.html(
          <div class="alert alert-warning alert-soft">
            <span>Demo accounts are limited to <strong>{bulkMax} indicators</strong> per Bulk Mode request. You submitted {indicators.length}. Please reduce your input or contact an admin.</span>
          </div>
        )
      }
      if (isCombined && indicators.length > combinedMax) {
        return c.html(
          <div class="alert alert-warning alert-soft">
            <span>Demo accounts are limited to <strong>{combinedMax} indicators</strong> per Combined Analysis. You submitted {indicators.length}. Please reduce your input or contact an admin.</span>
          </div>
        )
      }
    }

    // Jakarta time (WIB = UTC+7)
    const submittedAt =
      new Date().toLocaleString('en-GB', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }) + ' WIB'

    // Audit API URL
    const apiUrl =
      isCombined
        ? 'AbuseIPDB + VirusTotal + OTX Alienvault (parallel)'
        : source === 'AbuseIPDB'
          ? `https://api.abuseipdb.com/api/v2/check?maxAgeInDays=${maxAgeInDays}&verbose=1`
          : source === 'VirusTotal'
            ? 'https://www.virustotal.com/api/v3/{type}/{indicator}'
            : 'https://otx.alienvault.com/api/v1/indicators/IPv4/{indicator}/general'

    // Null-safe cell helpers
    const v = (val: any) => (val !== null && val !== undefined ? String(val) : '-')
    const bv = (val: any) => (val === null || val === undefined ? '-' : val ? 'Yes' : 'No')
    // Badge variant for whitelist: Yes → green badge, No → plain text
    const bvWL = (val: any) => val === null || val === undefined
      ? <span class="text-xs opacity-50">—</span>
      : val
        ? <span class="badge badge-success badge-sm font-bold">Yes ✓</span>
        : <span class="text-xs">No</span>
    const toJakartaTime = (dateStr: string | null | undefined): string => {
      if (!dateStr) return '-'
      try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return String(dateStr)
        return date.toLocaleString('en-GB', {
          timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }) + ' WIB'
      } catch { return String(dateStr) }
    }
    const unixToJakartaTime = (ts: number | null | undefined): string => {
      if (!ts) return '-'
      try {
        return new Date(ts * 1000).toLocaleString('en-GB', {
          timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }) + ' WIB'
      } catch { return '-' }
    }

    // ── COMBINED ANALYSIS: parallel multi-source per indicator ─────────────────
    if (isCombined) {
      type CombinedRow = {
        indicator: string
        abdb: any
        vt: any
        otx: any
        tfox: any
        errors: Record<string, string>
      }

      const combinedResults: CombinedRow[] = await Promise.all(
        indicators.map(async (indicator) => {
          const row: CombinedRow = { indicator, abdb: null, vt: null, otx: null, tfox: null, errors: {} }
          await Promise.all([
            combinedSources.includes('AbuseIPDB')
              ? checkAbuseIPDB(indicator, maxAgeInDays)
                  .then((r) => { row.abdb = formatAbuseIPDBResult(r) })
                  .catch((e) => { row.errors['AbuseIPDB'] = e instanceof Error ? e.message : 'Error' })
              : Promise.resolve(),
            combinedSources.includes('VirusTotal')
              ? checkVirusTotal(indicator)
                  .then((r) => { row.vt = formatVirusTotalResult(r, indicator) })
                  .catch((e) => { row.errors['VirusTotal'] = e instanceof Error ? e.message : 'Error' })
              : Promise.resolve(),
            combinedSources.includes('OTX Alienvault')
              ? checkOTX(indicator)
                  .then((r) => { row.otx = formatOTXResult(r, indicator) })
                  .catch((e) => { row.errors['OTX Alienvault'] = e instanceof Error ? e.message : 'Error' })
              : Promise.resolve(),
            combinedSources.includes('ThreatFOX')
              ? checkThreatFox(indicator)
                  .then((r) => { row.tfox = formatThreatFoxResult(r, indicator) })
                  .catch((e) => { row.errors['ThreatFOX'] = e instanceof Error ? e.message : 'Error' })
              : Promise.resolve(),
          ])
          return row
        })
      )

      const maliciousCount = combinedResults.filter((r) => {
        const abdbMal = r.abdb && (r.abdb.abuseConfidenceScore ?? 0) > 75
        const vtMal = r.vt && (r.vt.last_analysis_stats?.malicious ?? 0) > 0
        const otxMal = r.otx && r.otx.status === 'malicious'
        const tfoxMal = r.tfox && r.tfox.status === 'malicious'
        return abdbMal || vtMal || otxMal || tfoxMal
      }).length

      // Log each indicator result
      const _username = (c as any).get?.('username') as string ?? 'unknown'
      void logCheckEvents('intelligence', mode, source,
        combinedResults.map((r) => {
          const hasError = Object.keys(r.errors).length > 0 && !r.abdb && !r.vt && !r.otx
          const summaryObj: Record<string, any> = {}
          if (r.abdb) summaryObj.abdb = { status: r.abdb.status, score: r.abdb.abuseConfidenceScore, reports: r.abdb.totalReports, whitelisted: r.abdb.isWhitelisted }
          if (r.vt)   summaryObj.vt   = { status: r.vt.status, malicious: r.vt.last_analysis_stats?.malicious, suspicious: r.vt.last_analysis_stats?.suspicious }
          if (r.otx)  summaryObj.otx  = { status: r.otx.status, pulses: r.otx.pulse_count, whitelisted: r.otx.whitelisted }
          if (r.tfox) summaryObj.tfox = { status: r.tfox.status, malware: r.tfox.top_malware, confidence: r.tfox.confidence_level }
          if (Object.keys(r.errors).length > 0) summaryObj.errors = r.errors
          return {
            indicator: r.indicator,
            result: hasError ? 'error' as const : 'success' as const,
            detail: hasError ? JSON.stringify(r.errors) : undefined,
            summary: hasError ? null : JSON.stringify(summaryObj),
          }
        }),
        c.req.raw,
        { username: _username }
      )

      const renderCombinedCorrelation = () => {
        const valid = combinedResults.filter((r) => r.abdb || r.vt || r.otx || r.tfox)
        if (valid.length === 0) return null

        const malC = valid.filter((r) =>
          (r.abdb && (r.abdb.abuseConfidenceScore ?? 0) > 75) ||
          (r.vt && (r.vt.last_analysis_stats?.malicious ?? 0) > 0) ||
          (r.otx && r.otx.status === 'malicious') ||
          (r.tfox && r.tfox.status === 'malicious')
        ).length

        const susC = valid.filter((r) => {
          const isMal = (r.abdb && (r.abdb.abuseConfidenceScore ?? 0) > 75) ||
            (r.vt && (r.vt.last_analysis_stats?.malicious ?? 0) > 0) ||
            (r.otx && r.otx.status === 'malicious') ||
            (r.tfox && r.tfox.status === 'malicious')
          if (isMal) return false
          return (r.abdb && (r.abdb.abuseConfidenceScore ?? 0) > 25) ||
            (r.vt && (r.vt.last_analysis_stats?.suspicious ?? 0) > 0) ||
            (r.otx && r.otx.status === 'suspicious') ||
            (r.tfox && r.tfox.status === 'suspicious')
        }).length

        const cleanC = valid.length - malC - susC
        const countries = [...new Set(valid.flatMap((r) => [r.abdb?.countryCode, r.vt?.country].filter(Boolean)))] as string[]
        const isps = [...new Set(valid.map((r) => r.abdb?.isp).filter(Boolean))] as string[]
        const domains = [...new Set(valid.map((r) => r.abdb?.domain || r.vt?.rdap_name).filter(Boolean))] as string[]
        const allPulses = valid.flatMap((r) => (r.otx?.pulses ?? []).map((p: any) => p.name)).filter(Boolean)
        const uniquePulses = [...new Set(allPulses)] as string[]
        const malware = [...new Set(valid.map((r) => r.tfox?.top_malware).filter(Boolean))] as string[]
        const threatScore = valid.length > 0 ? Math.round((malC / valid.length) * 100) : 0
        const scoreBadge = threatScore > 60 ? 'badge-error' : threatScore > 20 ? 'badge-warning' : 'badge-success'

        return (
          <div class="rounded-xl border border-base-300 bg-base-100 shadow-sm overflow-hidden">
            {/* Header bar */}
            <div class="flex items-center justify-between px-4 py-3 bg-base-200/70 border-b border-base-300 flex-wrap gap-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-sm">🔗 Correlation Analysis</span>
                <span class="text-xs text-base-content/50">{valid.length} of {combinedResults.length} indicators resolved</span>
              </div>
              <div class="flex flex-wrap gap-2 items-center">
                <span class={`badge badge-sm font-bold ${scoreBadge}`}>Threat Score: {threatScore}%</span>
                {combinedSources.map((s) => <span key={s} class="badge badge-outline badge-xs">{s}</span>)}
              </div>
            </div>

            <div class="p-4 space-y-4">
              {/* Verdict summary */}
              <div class="flex flex-wrap gap-2 items-center">
                <span class="text-xs font-semibold text-base-content/50 uppercase tracking-wider">Verdicts</span>
                {malC > 0 && <span class="badge badge-error font-bold">🔴 {malC} Malicious</span>}
                {susC > 0 && <span class="badge badge-warning font-bold">🟡 {susC} Suspicious</span>}
                {cleanC > 0 && <span class="badge badge-success">🟢 {cleanC} Clean</span>}
              </div>

              {/* Per-indicator summary cards */}
              <div>
                <p class="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">Per-Indicator Summary</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {combinedResults.map((r, idx) => {
                    const isMal = (r.abdb && (r.abdb.abuseConfidenceScore ?? 0) > 75) ||
                                  (r.vt && (r.vt.last_analysis_stats?.malicious ?? 0) > 0) ||
                                  (r.otx && r.otx.status === 'malicious') ||
                                  (r.tfox && r.tfox.status === 'malicious')
                    const isSus = !isMal && (
                      (r.abdb && (r.abdb.abuseConfidenceScore ?? 0) > 25) ||
                      (r.vt && (r.vt.last_analysis_stats?.suspicious ?? 0) > 0) ||
                      (r.otx && r.otx.status === 'suspicious') ||
                      (r.tfox && r.tfox.status === 'suspicious')
                    )
                    const cardBorder = isMal ? 'border-error/50 bg-error/5' : isSus ? 'border-warning/40 bg-warning/5' : 'border-success/30 bg-success/5'
                    const verdictIcon = isMal ? '🔴' : isSus ? '🟡' : '🟢'
                    const hasError = Object.keys(r.errors).length > 0 && !r.abdb && !r.vt && !r.otx && !r.tfox
                    return (
                      <div key={idx} class={`rounded-lg border p-2 space-y-1 ${hasError ? 'border-base-300 bg-base-200/30' : cardBorder}`}>
                        <div class="flex items-center justify-between gap-1">
                          <span class="font-mono text-xs truncate flex-1" title={r.indicator}>{r.indicator}</span>
                          <span title={isMal ? 'Malicious' : isSus ? 'Suspicious' : hasError ? 'Error' : 'Clean'}>{hasError ? '⚠' : verdictIcon}</span>
                        </div>
                        {hasError ? (
                          <p class="text-xs text-error/70 truncate">Error fetching data</p>
                        ) : (
                          <div class="flex flex-wrap gap-1">
                            {combinedSources.includes('AbuseIPDB') && r.abdb && (
                              <span class={`badge badge-xs font-mono ${(r.abdb.abuseConfidenceScore ?? 0) > 75 ? 'badge-error' : (r.abdb.abuseConfidenceScore ?? 0) > 25 ? 'badge-warning' : 'badge-outline'}`}>
                                AB:{r.abdb.abuseConfidenceScore}%
                              </span>
                            )}
                            {combinedSources.includes('VirusTotal') && r.vt && (
                              <span class={`badge badge-xs font-mono ${(r.vt.last_analysis_stats?.malicious ?? 0) > 0 ? 'badge-error' : (r.vt.last_analysis_stats?.suspicious ?? 0) > 0 ? 'badge-warning' : 'badge-outline'}`}>
                                VT:{r.vt.last_analysis_stats?.malicious ?? 0}/{r.vt.last_analysis_stats?.suspicious ?? 0}/{r.vt.last_analysis_stats?.harmless ?? 0}
                              </span>
                            )}
                            {combinedSources.includes('OTX Alienvault') && r.otx && (
                              <span class={`badge badge-xs font-mono ${r.otx.status === 'malicious' ? 'badge-error' : r.otx.status === 'suspicious' ? 'badge-warning' : 'badge-outline'}`}>
                                OTX:{r.otx.pulse_count} Pul
                              </span>
                            )}
                            {combinedSources.includes('ThreatFOX') && r.tfox && r.tfox.found && (
                              <span class={`badge badge-xs font-mono ${r.tfox.status === 'malicious' ? 'badge-error' : r.tfox.status === 'suspicious' ? 'badge-warning' : 'badge-outline'}`}>
                                TFX:{r.tfox.confidence_level}%
                              </span>
                            )}
                            {combinedSources.includes('ThreatFOX') && r.tfox && !r.tfox.found && (
                              <span class="badge badge-xs badge-outline font-mono">TFX:—</span>
                            )}
                          </div>
                        )}
                        {r.tfox?.top_malware && (
                          <p class="text-xs text-error/80 truncate font-mono" title={r.tfox.top_malware}>☠ {r.tfox.top_malware}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Infrastructure correlation */}
              {(countries.length > 0 || isps.length > 0 || domains.length > 0 || uniquePulses.length > 0 || malware.length > 0) && (
                <div>
                  <p class="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">Infrastructure Correlation</p>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {countries.length > 0 && (
                      <div class="rounded-lg bg-base-200/60 px-3 py-2">
                        <p class="text-xs font-semibold text-base-content/50 mb-1">🌍 Countries</p>
                        <p class="text-xs font-mono">{countries.join(', ')}</p>
                      </div>
                    )}
                    {isps.length > 0 && (
                      <div class="rounded-lg bg-base-200/60 px-3 py-2">
                        <p class="text-xs font-semibold text-base-content/50 mb-1">🏢 ISPs</p>
                        <p class="text-xs font-mono">{isps.join(' · ')}</p>
                      </div>
                    )}
                    {domains.length > 0 && (
                      <div class="rounded-lg bg-base-200/60 px-3 py-2">
                        <p class="text-xs font-semibold text-base-content/50 mb-1">🌐 Domains / RDAP</p>
                        <p class="text-xs font-mono">{domains.join(' · ')}</p>
                      </div>
                    )}
                    {uniquePulses.length > 0 && (
                      <div class="rounded-lg bg-base-200/60 px-3 py-2">
                        <p class="text-xs font-semibold text-base-content/50 mb-1">📡 OTX Pulses</p>
                        <p class="text-xs font-mono">{uniquePulses.slice(0, 5).join(' · ')}{uniquePulses.length > 5 ? ` +${uniquePulses.length - 5} more` : ''}</p>
                      </div>
                    )}
                    {malware.length > 0 && (
                      <div class="rounded-lg bg-error/10 border border-error/20 px-3 py-2 sm:col-span-2">
                        <p class="text-xs font-semibold text-error/70 mb-1">☠ ThreatFOX Malware Families</p>
                        <p class="text-xs font-mono text-error">{malware.join(' · ')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }

      const renderCombinedTable = () => {
        // Pre-compute colSpan for full-row error cells
        const totalDataCols =
          (combinedSources.includes('AbuseIPDB') ? 4 : 0) +
          (combinedSources.includes('VirusTotal') ? 3 : 0) +
          (combinedSources.includes('OTX Alienvault') ? 4 : 0) +
          (combinedSources.includes('ThreatFOX') ? 3 : 0)
        return (
          <table class="table table-xs table-zebra w-full" id="resultsTable">
            <thead>
              <tr class="border-base-300">
                <th rowSpan={2} class="align-middle">Indicator</th>
                {combinedSources.includes('AbuseIPDB') && <th colSpan={4} class="text-center border-l border-base-300">AbuseIPDB</th>}
                {combinedSources.includes('VirusTotal') && <th colSpan={3} class="text-center border-l border-base-300">VirusTotal</th>}
                {combinedSources.includes('OTX Alienvault') && <th colSpan={4} class="text-center border-l border-base-300">OTX Alienvault</th>}
                {combinedSources.includes('ThreatFOX') && <th colSpan={3} class="text-center border-l border-base-300">ThreatFOX</th>}
              </tr>
              <tr class="border-base-300 text-xs">
                {combinedSources.includes('AbuseIPDB') && <>
                  <th class="border-l border-base-300">Whitelisted</th><th>Tor</th><th>Abuse Score</th><th>Reports</th>
                </>}
                {combinedSources.includes('VirusTotal') && <>
                  <th class="border-l border-base-300">Malicious</th><th>Suspicious</th><th>Harmless</th>
                </>}
                {combinedSources.includes('OTX Alienvault') && <>
                  <th class="border-l border-base-300">Status</th><th>Whitelisted</th><th>Reputation</th><th>Pulses</th>
                </>}
                {combinedSources.includes('ThreatFOX') && <>
                  <th class="border-l border-base-300">Malware</th><th>Confidence</th><th>Threat Type</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {combinedResults.map((r, idx) => {
                if (Object.keys(r.errors).length > 0 && !r.abdb && !r.vt && !r.otx && !r.tfox) {
                  const errMsg = Object.entries(r.errors).map(([k, v]) => `${k}: ${v}`).join('; ')
                  return (
                    <tr key={idx} class="hover:bg-base-200/50">
                      <td class="font-mono text-xs">{r.indicator}</td>
                      <td colSpan={totalDataCols} class="text-error text-xs">{errMsg}</td>
                    </tr>
                  )
                }
                const abdbScore = r.abdb?.abuseConfidenceScore ?? 0
                const abdbBadge = abdbScore > 75 ? 'badge-error' : abdbScore > 25 ? 'badge-warning' : 'badge-success'
                const vtSt = r.vt?.last_analysis_stats ?? {}
                const otxStatus = r.otx?.status ?? '-'
                const otxStatusColor = otxStatus === 'malicious' ? 'badge-error' : otxStatus === 'suspicious' ? 'badge-warning' : 'badge-success'
                const otxRepColor = (r.otx?.reputation ?? 0) < 0 ? 'text-error' : (r.otx?.reputation ?? 0) > 0 ? 'text-success' : 'text-base-content/60'
                const tfoxConf = r.tfox?.confidence_level ?? 0
                const tfoxConfBadge = tfoxConf >= 75 ? 'badge-error' : tfoxConf >= 30 ? 'badge-warning' : 'badge-outline'
                return (
                  <tr key={idx} class="hover:bg-base-200/50">
                    <td class="font-mono text-xs whitespace-nowrap">{r.indicator}</td>
                    {combinedSources.includes('AbuseIPDB') && (
                      r.errors['AbuseIPDB'] ? (
                        <><td colSpan={4} class="text-error text-xs border-l border-base-300">{r.errors['AbuseIPDB']}</td></>
                      ) : r.abdb ? (
                        <>
                          <td class="text-xs border-l border-base-300">{bvWL(r.abdb.isWhitelisted)}</td>
                          <td class="text-xs">{bv(r.abdb.isTor)}</td>
                          <td><span class={`badge badge-sm font-bold ${abdbBadge}`}>{abdbScore}%</span></td>
                          <td class="text-xs">{v(r.abdb.totalReports)}</td>
                        </>
                      ) : (
                        <><td colSpan={4} class="text-xs text-base-content/40 italic border-l border-base-300">—</td></>
                      )
                    )}
                    {combinedSources.includes('VirusTotal') && (
                      r.errors['VirusTotal'] ? (
                        <><td colSpan={3} class="text-error text-xs border-l border-base-300">{r.errors['VirusTotal']}</td></>
                      ) : r.vt ? (
                        <>
                          <td class="border-l border-base-300"><span class={`badge badge-sm font-bold ${(vtSt.malicious ?? 0) > 0 ? 'badge-error' : 'badge-outline'}`}>{vtSt.malicious ?? 0}</span></td>
                          <td><span class={`badge badge-sm font-bold ${(vtSt.suspicious ?? 0) > 0 ? 'badge-warning' : 'badge-outline'}`}>{vtSt.suspicious ?? 0}</span></td>
                          <td><span class={`badge badge-sm font-bold ${(vtSt.harmless ?? 0) > 0 ? 'badge-success' : 'badge-outline'}`}>{vtSt.harmless ?? 0}</span></td>
                        </>
                      ) : (
                        <><td colSpan={3} class="text-xs text-base-content/40 italic border-l border-base-300">—</td></>
                      )
                    )}
                    {combinedSources.includes('OTX Alienvault') && (
                      r.errors['OTX Alienvault'] ? (
                        <><td colSpan={4} class="text-error text-xs border-l border-base-300">{r.errors['OTX Alienvault']}</td></>
                      ) : r.otx ? (
                        <>
                          <td class="border-l border-base-300"><span class={`badge badge-sm font-bold ${otxStatusColor}`}>{otxStatus}</span></td>
                          <td class="text-xs">{bvWL(r.otx.whitelisted)}</td>
                          <td class={`text-xs font-semibold ${otxRepColor}`}>{v(r.otx.reputation)}</td>
                          <td class="text-xs">{v(r.otx.pulse_count)}</td>
                        </>
                      ) : (
                        <><td colSpan={4} class="text-xs text-base-content/40 italic border-l border-base-300">—</td></>
                      )
                    )}
                    {combinedSources.includes('ThreatFOX') && (
                      r.errors['ThreatFOX'] ? (
                        <><td colSpan={3} class="text-error text-xs border-l border-base-300">{r.errors['ThreatFOX']}</td></>
                      ) : r.tfox ? (
                        r.tfox.found ? (
                          <>
                            <td class="text-xs border-l border-base-300 max-w-32 truncate" title={r.tfox.top_malware ?? '-'}>{r.tfox.top_malware ?? '-'}</td>
                            <td><span class={`badge badge-sm font-bold ${tfoxConfBadge}`}>{tfoxConf}%</span></td>
                            <td class="text-xs">{r.tfox.top_threat_type ?? '-'}</td>
                          </>
                        ) : (
                          <><td colSpan={3} class="text-xs text-base-content/40 italic border-l border-base-300">Not found</td></>
                        )
                      ) : (
                        <><td colSpan={3} class="text-xs text-base-content/40 italic border-l border-base-300">—</td></>
                      )
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )
      }

      return c.html(
        <div class="space-y-4">
          <p class="text-sm text-base-content/60">
            Mode: <span class="font-semibold">{mode}</span> | Sources:{' '}
            <span class="font-semibold">{source}</span> | Indicators:{' '}
            <span class="font-semibold">{combinedResults.length}</span>
          </p>

          {renderCombinedCorrelation()}

          <details class="group border border-base-300 rounded-lg overflow-hidden">
            <summary class="flex items-center gap-2 cursor-pointer select-none bg-base-200/50 px-3 py-2 text-sm font-semibold text-base-content/80 hover:bg-base-200 transition-colors list-none">
              <span class="inline-block transition-transform duration-200 group-open:rotate-90 text-xs">▶</span>
              Detailed Results Table
              <span class="badge badge-ghost badge-xs ml-auto">click to expand</span>
            </summary>
            <div class="overflow-x-auto">
              <div class="min-w-max">
                {renderCombinedTable()}
              </div>
            </div>
          </details>

          <div class="border border-base-300 rounded-lg p-3 bg-base-200/50 text-xs space-y-1 text-base-content/70">
            <p class="font-semibold text-base-content/90 mb-1">Audit Information</p>
            <p>Date Submitted: <span class="font-mono">{submittedAt}</span></p>
            <p>API Endpoint: <span class="font-mono break-all">{apiUrl}</span></p>
          </div>

          <div class="flex flex-wrap gap-2">
            <button class="btn btn-sm btn-outline" id="newCheckBtn">↩ New Check</button>
            <button class="btn btn-sm btn-outline" id="copyTableBtn">📋 Copy to Clipboard</button>
            <button class="btn btn-sm btn-outline" id="exportCsvBtn">⬇ Export to CSV</button>
          </div>

          <script
            id="resultsData"
            type="application/json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({ mode, source, maxAgeInDays, combinedResults, maliciousCount }).replace(/<\/script/gi, '<\\/script'),
            }}
          />
        </div>
      )
    }

    // ── SINGLE / BULK MODE ─────────────────────────────────────────────────────
    const results: { indicator: string; source: string; result: any; error?: string }[] = []

    for (const indicator of indicators) {
      const trimmed = indicator.trim()
      if (!trimmed) continue
      try {
        let result: any = null
        switch (source) {
          case 'AbuseIPDB':
            result = formatAbuseIPDBResult(await checkAbuseIPDB(trimmed, maxAgeInDays))
            break
          case 'VirusTotal':
            result = formatVirusTotalResult(await checkVirusTotal(trimmed), trimmed)
            break
          case 'OTX Alienvault':
            result = formatOTXResult(await checkOTX(trimmed), trimmed)
            break
          case 'ThreatFOX':
            result = formatThreatFoxResult(await checkThreatFox(trimmed), trimmed)
            break
        }
        results.push({ indicator: trimmed, source, result })
      } catch (err) {
        results.push({
          indicator: trimmed,
          source,
          result: null,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    const renderAbuseIPDBTable = () => (
      <table class="table table-xs table-zebra w-full" id="resultsTable">
        <thead>
          <tr class="border-base-300">
            <th>IP Address</th>
            <th>Whitelisted</th>
            <th>Tor</th>
            <th>Abuse Score</th>
            <th>Reports</th>
            <th>Country</th>
            <th>Country Name</th>
            <th>ISP</th>
            <th>Domain</th>
            <th>Hostnames</th>
            <th>Usage Type</th>
            <th>Last Reported</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, idx) => {
            if (r.error) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={11} class="text-error text-xs">{r.error}</td>
                </tr>
              )
            }
            if (!r.result) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={11} class="text-base-content/50 text-xs italic">Not found / unsupported indicator type</td>
                </tr>
              )
            }
            const d = r.result
            const abuseScore = d.abuseConfidenceScore ?? 0
            const abuseBadge = abuseScore > 75 ? 'badge-error' : abuseScore > 25 ? 'badge-warning' : 'badge-success'
            return (
              <tr key={idx} class="hover:bg-base-200/50">
                <td class="font-mono text-xs">{v(d.ipAddress)}</td>
                <td class="text-xs">{bvWL(d.isWhitelisted)}</td>
                <td class="text-xs">{bv(d.isTor)}</td>
                <td><span class={`badge badge-sm font-bold ${abuseBadge}`}>{abuseScore}%</span></td>
                <td class="text-xs">{v(d.totalReports)}</td>
                <td class="text-xs">{v(d.countryCode)}</td>
                <td class="text-xs">{v(d.countryName)}</td>
                <td class="text-xs truncate max-w-40" title={v(d.isp)}>{v(d.isp)}</td>
                <td class="text-xs">{v(d.domain)}</td>
                <td class="text-xs truncate max-w-32" title={(d.hostnames ?? []).join(', ')}>
                  {(d.hostnames ?? []).length > 0 ? (d.hostnames as string[]).join(', ') : '-'}
                </td>
                <td class="text-xs">{v(d.usageType)}</td>
                <td class="text-xs whitespace-nowrap">{toJakartaTime(d.lastReportedAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )

    const renderVirusTotalTable = () => (
      <table class="table table-xs table-zebra w-full" id="resultsTable">
        <thead>
          <tr class="border-base-300">
            <th>ID</th>
            <th>Malicious</th>
            <th>Suspicious</th>
            <th>Harmless</th>
            <th>RDAP Name</th>
            <th>Country</th>
            <th>AS Owner</th>
            <th>Votes (+)</th>
            <th>Votes (-)</th>
            <th>Reputation</th>
            <th>Tags</th>
            <th>Crowdsourced Context</th>
            <th>Last Analysis</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, idx) => {
            if (r.error) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={12} class="text-error text-xs">{r.error}</td>
                </tr>
              )
            }
            if (!r.result) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={12} class="text-base-content/50 text-xs italic">Not found / unsupported indicator type</td>
                </tr>
              )
            }
            const d = r.result
            const st = d.last_analysis_stats ?? {}
            const ctxSummary =
              Array.isArray(d.crowdsourced_context) && d.crowdsourced_context.length > 0
                ? d.crowdsourced_context
                    .map((cx: any) => `[${v(cx.severity)}] ${v(cx.title)}: ${v(cx.details)} (${v(cx.source)})`)
                    .join(' | ')
                : '-'
            return (
              <tr key={idx} class="hover:bg-base-200/50">
                <td class="font-mono text-xs">{v(d.id)}</td>
                <td><span class={`badge badge-sm font-bold ${ (st.malicious ?? 0) > 0 ? 'badge-error' : 'badge-outline'}`}>{st.malicious ?? 0}</span></td>
                <td><span class={`badge badge-sm font-bold ${ (st.suspicious ?? 0) > 0 ? 'badge-warning' : 'badge-outline'}`}>{st.suspicious ?? 0}</span></td>
                <td><span class={`badge badge-sm font-bold ${ (st.harmless ?? 0) > 0 ? 'badge-success' : 'badge-outline'}`}>{st.harmless ?? 0}</span></td>
                <td class="text-xs">{v(d.rdap_name)}</td>
                <td class="text-xs">{v(d.country)}</td>
                <td class="text-xs truncate max-w-32" title={v(d.as_owner)}>{v(d.as_owner)}</td>
                <td class="text-xs text-success font-semibold">{d.total_votes ? v(d.total_votes.harmless) : '-'}</td>
                <td class="text-xs text-error font-semibold">{d.total_votes ? v(d.total_votes.malicious) : '-'}</td>
                <td class={`text-xs font-semibold ${ (d.reputation ?? 0) < 0 ? 'text-error' : (d.reputation ?? 0) > 0 ? 'text-success' : 'text-base-content/60'}`}>{v(d.reputation)}</td>
                <td class="text-xs truncate max-w-24" title={Array.isArray(d.tags) ? (d.tags as string[]).join(', ') : '-'}>
                  {Array.isArray(d.tags) && d.tags.length > 0 ? (d.tags as string[]).join(', ') : '-'}
                </td>
                <td class="text-xs truncate max-w-48" title={ctxSummary}>{ctxSummary}</td>
                <td class="text-xs whitespace-nowrap">{toJakartaTime(d.last_analysis_date)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )

    const renderOTXTable = () => (
      <table class="table table-xs table-zebra w-full" id="resultsTable">
        <thead>
          <tr class="border-base-300">
            <th>Indicator</th>
            <th>Status</th>
            <th>Whitelisted</th>
            <th>Reputation</th>
            <th>Pulse Count</th>
            <th>Pulse Names</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, idx) => {
            if (r.error) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={5} class="text-error text-xs">{r.error}</td>
                </tr>
              )
            }
            if (!r.result) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={5} class="text-base-content/50 text-xs italic">Not found / unsupported indicator type</td>
                </tr>
              )
            }
            const d = r.result
            const statusColor = d.status === 'malicious' ? 'badge-error' : d.status === 'suspicious' ? 'badge-warning' : 'badge-success'
            const repColor = (d.reputation ?? 0) < 0 ? 'text-error' : (d.reputation ?? 0) > 0 ? 'text-success' : 'text-base-content/60'
            const pulseNamesList = Array.isArray(d.pulses) && d.pulses.length > 0
              ? (d.pulses as Array<{ name: string }>).map(p => p.name).join(' · ')
              : '-'
            return (
              <tr key={idx} class="hover:bg-base-200/50">
                <td class="font-mono text-xs">{v(d.indicator)}</td>
                <td><span class={`badge badge-sm font-bold ${statusColor}`}>{v(d.status)}</span></td>
                <td class="text-xs">{bvWL(d.whitelisted)}</td>
                <td class={`text-xs font-semibold ${repColor}`}>{v(d.reputation)}</td>
                <td class="text-xs">{v(d.pulse_count)}</td>
                <td class="text-xs truncate max-w-72" title={pulseNamesList}>{pulseNamesList}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )

    const renderThreatFoxTable = () => (
      <table class="table table-xs table-zebra w-full" id="resultsTable">
        <thead>
          <tr class="border-base-300">
            <th>Indicator</th>
            <th>Status</th>
            <th>Malware</th>
            <th>Confidence</th>
            <th>Threat Type</th>
            <th>First Seen</th>
            <th>Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, idx) => {
            if (r.error) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={6} class="text-error text-xs">{r.error}</td>
                </tr>
              )
            }
            if (!r.result) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={6} class="text-base-content/50 text-xs italic">Not found / unsupported indicator type</td>
                </tr>
              )
            }
            const d = r.result
            const statusColor = d.status === 'malicious' ? 'badge-error' : d.status === 'suspicious' ? 'badge-warning' : 'badge-success'
            const confBadge = (d.confidence_level ?? 0) >= 75 ? 'badge-error' : (d.confidence_level ?? 0) >= 30 ? 'badge-warning' : 'badge-outline'
            return (
              <tr key={idx} class="hover:bg-base-200/50">
                <td class="font-mono text-xs">{v(d.indicator)}</td>
                <td><span class={`badge badge-sm font-bold ${statusColor}`}>{v(d.status)}</span></td>
                <td class="text-xs truncate max-w-40" title={d.found ? v(d.top_malware) : '-'}>
                  {d.found ? v(d.top_malware) : <span class="opacity-40 italic">Not found in ThreatFOX</span>}
                </td>
                <td>
                  {d.found
                    ? <span class={`badge badge-sm font-bold ${confBadge}`}>{d.confidence_level ?? 0}%</span>
                    : <span class="text-xs opacity-40">—</span>}
                </td>
                <td class="text-xs">{d.found ? v(d.top_threat_type) : '-'}</td>
                <td class="text-xs whitespace-nowrap">{d.found ? toJakartaTime(d.first_seen) : '-'}</td>
                <td class="text-xs whitespace-nowrap">{d.found ? toJakartaTime(d.last_seen) : '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )

    // Compute malicious count for session stats
    const maliciousCount = results.filter(r => r.result?.status === 'malicious').length

    // Log each indicator result
    const _username = (c as any).get?.('username') as string ?? 'unknown'
    void logCheckEvents('intelligence', mode, source,
      results.map((r) => {
        if (r.error) return { indicator: r.indicator, result: 'error' as const, detail: r.error, summary: null }
        const s = r.result
        let summaryObj: Record<string, any> | null = null
        if (s) {
          if (source === 'AbuseIPDB') summaryObj = { status: s.status, score: s.abuseConfidenceScore, reports: s.totalReports, whitelisted: s.isWhitelisted }
          else if (source === 'VirusTotal') summaryObj = { status: s.status, malicious: s.last_analysis_stats?.malicious, suspicious: s.last_analysis_stats?.suspicious }
          else if (source === 'OTX Alienvault') summaryObj = { status: s.status, pulses: s.pulse_count, whitelisted: s.whitelisted }
          else if (source === 'ThreatFOX') summaryObj = { status: s.status, malware: s.top_malware, confidence: s.confidence_level }
        }
        return { indicator: r.indicator, result: 'success' as const, summary: summaryObj ? JSON.stringify(summaryObj) : null }
      }),
      c.req.raw,
      { username: _username }
    )

    // Combined Analysis: cross-indicator correlation helpers
    const renderCorrelation = () => {
      if (mode !== 'Combined Analysis' || results.length < 1) return null
      const valid = results.filter(r => r.result && !r.error)
      if (valid.length === 0) return null
      const malC = valid.filter(r => r.result.status === 'malicious').length
      const susC = valid.filter(r => r.result.status === 'suspicious').length
      const cleanC = valid.filter(r => r.result.status === 'clean').length
      const countries = [...new Set(valid.map(r => r.result.countryCode || r.result.country).filter(Boolean))] as string[]
      const isps = [...new Set(valid.map(r => r.result.isp).filter(Boolean))] as string[]
      const domains = [...new Set(valid.map(r => r.result.domain).filter(Boolean))] as string[]
      const allPulseNames = valid.flatMap(r => (r.result.pulses ?? []).map((p: any) => p.name)).filter(Boolean) as string[]
      const uniquePulses = [...new Set(allPulseNames)] as string[]
      const threatScore = Math.round((malC / valid.length) * 100)
      const scoreColor = threatScore > 60 ? 'badge-error' : threatScore > 20 ? 'badge-warning' : 'badge-success'
      return (
        <div class="rounded-lg border border-base-300 bg-base-200/50 p-4 space-y-3">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="font-bold text-sm text-base-content/90">🔗 Correlation Analysis</p>
            <span class={`badge badge-sm font-bold ${scoreColor}`}>Threat Score {threatScore}%</span>
            <span class="text-xs text-base-content/50">{valid.length} of {results.length} resolved</span>
          </div>
          <div class="flex flex-wrap gap-2 items-center text-xs">
            <span class="text-base-content/60">Verdicts:</span>
            {malC > 0 && <span class="badge badge-error badge-sm font-bold">{malC} Malicious</span>}
            {susC > 0 && <span class="badge badge-warning badge-sm font-bold">{susC} Suspicious</span>}
            {cleanC > 0 && <span class="badge badge-success badge-sm font-bold">{cleanC} Clean</span>}
          </div>
          {countries.length > 0 && (
            <p class="text-xs">
              <span class="text-base-content/60 font-semibold">Countries: </span>
              <span class="font-mono">{countries.join(', ')}</span>
            </p>
          )}
          {isps.length > 0 && (
            <p class="text-xs">
              <span class="text-base-content/60 font-semibold">ISPs: </span>
              <span class="font-mono">{isps.join(' · ')}</span>
            </p>
          )}
          {domains.length > 0 && (
            <p class="text-xs">
              <span class="text-base-content/60 font-semibold">Domains: </span>
              <span class="font-mono">{domains.join(' · ')}</span>
            </p>
          )}
          {uniquePulses.length > 0 && (
            <p class="text-xs">
              <span class="text-base-content/60 font-semibold">Shared OTX Pulses: </span>
              <span class="font-mono">{uniquePulses.slice(0, 5).join(' · ')}{uniquePulses.length > 5 ? ` +${uniquePulses.length - 5} more` : ''}</span>
            </p>
          )}
        </div>
      )
    }

    return c.html(
      <div class="space-y-4">
        <p class="text-sm text-base-content/60">
          Mode: <span class="font-semibold">{mode}</span> | Source:{' '}
          <span class="font-semibold">{source}</span> | Total:{' '}
          <span class="font-semibold">{results.length}</span>
        </p>

        <div class="overflow-x-auto rounded-lg border border-base-300">
          <div class="min-w-max">
          {source === 'AbuseIPDB'
            ? renderAbuseIPDBTable()
            : source === 'VirusTotal'
              ? renderVirusTotalTable()
              : source === 'ThreatFOX'
                ? renderThreatFoxTable()
                : renderOTXTable()}
          </div>
        </div>

        {/* Correlation panel — Combined Analysis only */}
        {renderCorrelation()}

        {/* Single Mode JSON tree — only for exactly 1 result */}
        {mode === 'Single Mode' && results.length === 1 && results[0].result && (
          <details open class="group border border-base-300 rounded-lg overflow-hidden">
            <summary class="flex items-center gap-2 cursor-pointer select-none bg-base-200/50 px-3 py-2 text-sm font-semibold text-base-content/80 hover:bg-base-200 transition-colors list-none">
              <span class="inline-block transition-transform duration-200 group-open:rotate-90 text-xs">▶</span>
              Raw JSON Response
              <span class="badge badge-ghost badge-xs ml-auto">click to collapse</span>
            </summary>
            <pre class="text-xs font-mono text-base-content bg-base-300/20 p-4 overflow-x-auto max-h-80 overflow-y-auto border-t border-base-300">{JSON.stringify(results[0].result, null, 2)}</pre>
          </details>
        )}

        {/* Audit Information */}
        <div class="border border-base-300 rounded-lg p-3 bg-base-200/50 text-xs space-y-1 text-base-content/70">
          <p class="font-semibold text-base-content/90 mb-1">Audit Information</p>
          <p>Date Submitted: <span class="font-mono">{submittedAt}</span></p>
          <p>API Endpoint: <span class="font-mono break-all">{apiUrl}</span></p>
        </div>

        {/* Action Buttons */}
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-sm btn-outline" id="newCheckBtn">↩ New Check</button>
          <button class="btn btn-sm btn-outline" id="copyTableBtn">📋 Copy to Clipboard</button>
          <button class="btn btn-sm btn-outline" id="exportCsvBtn">⬇ Export to CSV</button>
          <button class="btn btn-sm btn-outline" id="copyPtmBtn">🔗 Copy Formatted IP</button>
        </div>

        {/* Hidden JSON payload for client-side button actions */}
        <script
          id="resultsData"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ mode, source, maxAgeInDays, results, maliciousCount }).replace(/<\/script/gi, '<\\/script'),
          }}
        />
      </div>
    )
  } catch (error) {
    console.error('Check error:', error)
    return c.html(
      <div class="alert alert-error alert-soft">
        <span>{error instanceof Error ? error.message : 'An unexpected error occurred'}</span>
      </div>
    )
  }
})

// GET / — rendered through the shared jsxRenderer (sidebar + navbar included automatically)
intelligence.get('/', (c) => {
  return c.render(
    <div class="space-y-6">
      {/* PAGE HEADER */}
      <div>
        <h1 class="text-4xl font-bold mb-2">Threat Intelligence</h1>
        <p class="text-base-content/70">
          Analyze indicators across multiple threat intelligence sources
        </p>
      </div>

      {/* STATS ROW */}
      <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div class="stat bg-base-100 shadow-md border border-base-300 rounded-lg">
          <div class="stat-figure text-3xl">📊</div>
          <div class="stat-title text-sm opacity-70">Sources</div>
          <div class="stat-value text-2xl text-primary">4 of 7</div>
          <div class="stat-desc text-xs opacity-50">AbuseIPDB, VT, OTX, ThreatFOX</div>
        </div>
        <div class="stat bg-base-100 shadow-md border border-base-300 rounded-lg">
          <div class="stat-figure text-3xl">✓</div>
          <div class="stat-title text-sm opacity-70">Checks Today</div>
          <div id="stat-checks" class="stat-value text-2xl text-success">0</div>
          <div class="stat-desc text-xs opacity-50">This session</div>
        </div>
        <div class="stat bg-base-100 shadow-md border border-base-300 rounded-lg">
          <div class="stat-figure text-3xl">⚡</div>
          <div class="stat-title text-sm opacity-70">Avg Speed</div>
          <div id="stat-speed" class="stat-value text-2xl text-info">—</div>
          <div class="stat-desc text-xs opacity-50">Per lookup, this session</div>
        </div>
        <div class="stat bg-base-100 shadow-md border border-base-300 rounded-lg">
          <div class="stat-figure text-3xl">🛡️</div>
          <div class="stat-title text-sm opacity-70">Malicious Found</div>
          <div id="stat-malicious" class="stat-value text-2xl text-warning">0</div>
          <div class="stat-desc text-xs opacity-50">This session</div>
        </div>
      </div>

      {/* CHECKER CARD */}
      <div class="card bg-base-100 shadow-md border border-base-300">
        <div class="card-body gap-5">
          <h2 class="card-title">🔍 Check Indicators</h2>

          <form id="checkForm">
            {/* MODE SELECTOR */}
            <div class="mb-5">
              <label class="label pb-1">
                <span class="label-text font-semibold">Mode</span>
                <span class="text-xs text-base-content/60">Auto-detected from input</span>
              </label>
              <div class="flex gap-2 flex-wrap">
                {(['Single Mode', 'Bulk Mode', 'Combined Analysis'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    class={`btn btn-sm modeBtn ${m === 'Single Mode' ? 'btn-primary' : 'btn-outline'}`}
                    data-mode={m}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <input type="hidden" name="mode" id="modeInput" value="Single Mode" />
            </div>

            {/* SOURCE SELECTOR — shown for Single/Bulk modes */}
            <div id="sourceRadioGroup" class="mb-5">
              <label class="label pb-1">
                <span class="label-text font-semibold">Select Source</span>
              </label>
              <div class="flex flex-wrap gap-3">
                {[
                  { value: 'SOC Radar', disabled: true },
                  { value: 'VirusTotal', disabled: false },
                  { value: 'AbuseIPDB', disabled: false, checked: true },
                  { value: 'IBM X-Force', disabled: true },
                  { value: 'OTX Alienvault', disabled: false },
                  { value: 'MXtoolbox', disabled: true },
                  { value: 'ThreatFOX', disabled: false },
                ].map((s) => (
                  <label
                    key={s.value}
                    class={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${s.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-base-200'}`}
                  >
                    <input
                      type="radio"
                      name="source"
                      value={s.value}
                      disabled={s.disabled}
                      checked={s.checked}
                      class="radio radio-primary radio-sm"
                    />
                    <span class={`text-sm font-medium ${s.disabled ? 'line-through' : ''}`}>
                      {s.value}
                    </span>
                  </label>
                ))}
              </div>
              <p class="text-xs text-base-content/60 mt-1">More sources coming soon</p>
            </div>

            {/* COMBINED SOURCES SELECTOR — shown only in Combined Analysis mode */}
            <div id="sourceCheckboxGroup" class="mb-5 hidden">
              <label class="label pb-1">
                <span class="label-text font-semibold">Sources to Query</span>
                <span class="text-xs text-base-content/60">All selected sources will be queried in parallel</span>
              </label>
              <div class="flex flex-wrap gap-3">
                {[
                  { value: 'AbuseIPDB', defaultChecked: true },
                  { value: 'VirusTotal', defaultChecked: true },
                  { value: 'OTX Alienvault', defaultChecked: true },
                  { value: 'ThreatFOX', defaultChecked: true },
                ].map((s) => (
                  <label key={s.value} class="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-base-200 transition-colors">
                    <input
                      type="checkbox"
                      name="sources"
                      value={s.value}
                      checked={s.defaultChecked}
                      class="checkbox checkbox-primary checkbox-sm"
                    />
                    <span class="text-sm font-medium">{s.value}</span>
                  </label>
                ))}
              </div>
              <p class="text-xs text-base-content/60 mt-1">Results appear in a unified table per indicator</p>
            </div>

            {/* MAX AGE IN DAYS — only visible for AbuseIPDB */}
            <div id="maxAgeContainer" class="mb-5">
              <label class="label pb-1">
                <span class="label-text font-semibold">Max Age In Days</span>
                <span class="text-xs text-base-content/60">AbuseIPDB report history window</span>
              </label>
              <input
                type="number"
                name="maxAgeInDays"
                id="maxAgeInput"
                min="1"
                max="365"
                value="180"
                class="input input-bordered input-sm w-40"
              />
              <p class="text-xs text-base-content/60 mt-1">Range: 1–365 days (default 180)</p>
            </div>

            {/* INDICATORS INPUT */}
            <textarea
              name="indicators"
              id="indicatorsInput"
              placeholder={`Enter indicators (one per line):\n- Single line → Single Mode\n- Multiple lines → Bulk Mode`}
              class="textarea textarea-bordered h-36 focus:textarea-primary w-full resize-none mb-5"
            />

            <button type="submit" class="btn btn-primary w-full">
              Check Indicator
            </button>
          </form>
        </div>
      </div>

      {/* RESULTS CARD */}
      <div class="card bg-base-100 shadow-md border border-base-300">
        <div class="card-body">
          <h2 class="card-title mb-2">Results</h2>
          <div id="resultsArea" class="alert alert-info alert-soft">
            <span>Enter an indicator and select a source to see results here</span>
          </div>
        </div>
      </div>

      {/* MODE INFO CARDS */}
      <div class="grid gap-4 grid-cols-1 md:grid-cols-3">
        <div id="modeCard-single" class="card bg-base-100 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg">
              <span class="text-3xl">1️⃣</span>
              Single Mode
            </h2>
            <p class="text-sm text-base-content/70">Check one indicator at a time with full detail view</p>
            <p class="text-xs font-semibold mt-2">Supports:</p>
            <ul class="text-xs space-y-1 list-disc list-inside opacity-70">
              <li>IPv4 & IPv6 addresses</li>
              <li>Domains & subdomains</li>
              <li>URLs & file paths</li>
              <li>File hashes (MD5, SHA-1, SHA-256)</li>
            </ul>
            <p id="modeCardHint-single" class="text-xs mt-2 text-primary font-semibold">Expands raw JSON below results</p>
          </div>
        </div>
        <div id="modeCard-bulk" class="card bg-base-100 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg">
              <span class="text-3xl">📋</span>
              Bulk Mode
            </h2>
            <p class="text-sm text-base-content/70">Check multiple indicators at once in a table</p>
            <p class="text-xs font-semibold mt-2">Limits:</p>
            <ul class="text-xs space-y-1 list-disc list-inside opacity-70">
              <li>No indicator limit</li>
              <li>One per line in textarea</li>
              <li>Mixed types supported (IP, domain, hash)</li>
              <li>Export to CSV available</li>
            </ul>
            <p id="modeCardHint-bulk" class="text-xs mt-2 text-base-content/40">Auto-detected when &gt;1 line</p>
          </div>
        </div>
        <div id="modeCard-combined" class="card bg-base-100 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg">
              <span class="text-3xl">🔗</span>
              Combined Analysis
            </h2>
            <p class="text-sm text-base-content/70">Cross-correlate multiple indicators together</p>
            <p class="text-xs font-semibold mt-2">Features:</p>
            <ul class="text-xs space-y-1 list-disc list-inside opacity-70">
              <li>Threat score across indicators</li>
              <li>Shared country / ISP / domain</li>
              <li>OTX pulse overlap + ThreatFOX malware</li>
              <li>Max 10 indicators per run</li>
            </ul>
            <p id="modeCardHint-combined" class="text-xs mt-2 text-base-content/40">Select manually above</p>
          </div>
        </div>
      </div>

      {/* HELP ALERT */}
      <div class="alert alert-info alert-soft">
        <span class="text-xl">ℹ️</span>
        <div>
          <h3 class="font-bold">Need Help?</h3>
          <p class="text-sm">
            Check our documentation at{' '}
            <a href="https://github.com/gansbeud/komcad/" target="_blank" rel="noopener" class="link link-hover text-primary">github.com/gansbeud/komcad</a>
            {' '}for API integration, bulk import guides, and source accuracy rates.
          </p>
        </div>
      </div>

      {/* CLIENT-SIDE LOGIC */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function () {
  // ── Mode buttons ────────────────────────────────────────────────────────────
  function setMode(mode) {
    document.getElementById('modeInput').value = mode;
    document.querySelectorAll('.modeBtn').forEach(function (btn) {
      var active = btn.getAttribute('data-mode') === mode;
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-outline', !active);
    });
    var isCombined = mode === 'Combined Analysis';
    var radioGroup = document.getElementById('sourceRadioGroup');
    var checkboxGroup = document.getElementById('sourceCheckboxGroup');
    if (radioGroup) radioGroup.style.display = isCombined ? 'none' : '';
    if (checkboxGroup) checkboxGroup.classList.toggle('hidden', !isCombined);
    updateMaxAgeVisibility();
  }

  function updateModeFromInput() {
    var lines = document.getElementById('indicatorsInput').value.trim().split('\\n').filter(function (l) { return l.trim(); });
    var currentMode = document.getElementById('modeInput').value;
    if (currentMode !== 'Combined Analysis') {
      setMode(lines.length <= 1 ? 'Single Mode' : 'Bulk Mode');
    }
    var singleBtn = document.querySelector('.modeBtn[data-mode="Single Mode"]');
    if (singleBtn) singleBtn.disabled = lines.length > 1;
  }

  document.querySelectorAll('.modeBtn').forEach(function (btn) {
    btn.addEventListener('click', function () { setMode(this.getAttribute('data-mode')); });
  });

  document.getElementById('indicatorsInput').addEventListener('input', updateModeFromInput);

  // ── MaxAge visibility (only for AbuseIPDB) ──────────────────────────────────
  function updateMaxAgeVisibility() {
    var source = document.querySelector('input[name="source"]:checked');
    var container = document.getElementById('maxAgeContainer');
    var isCombined = document.getElementById('modeInput').value === 'Combined Analysis';
    if (container) {
      container.style.display = (!isCombined && source && source.value === 'AbuseIPDB') ? '' : 'none';
    }
  }

  document.querySelectorAll('input[name="source"]').forEach(function (radio) {
    radio.addEventListener('change', updateMaxAgeVisibility);
  });
  updateMaxAgeVisibility();

  // ── Form submit ──────────────────────────────────────────────────────────────
  async function handleFormSubmit(event) {
    event.preventDefault();
    var form = event.target;
    var submitBtn = form.querySelector('[type="submit"]');
    var resultsArea = document.getElementById('resultsArea');
    // Prevent double-submit
    if (submitBtn && submitBtn.disabled) return;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Checking…'; }
    resultsArea.innerHTML = '<div class="flex justify-center py-6"><span class="loading loading-spinner loading-lg"></span></div>';
    var t0 = Date.now();
    try {
      var response = await fetch('/intelligence/api/check', { method: 'POST', body: new FormData(form) });
      var html = await response.text();
      var elapsed = (Date.now() - t0) / 1000;
      resultsArea.innerHTML = html;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Check Indicator'; }

      // checks count
      var checks = parseInt(sessionStorage.getItem('intel_checks') || '0') + 1;
      sessionStorage.setItem('intel_checks', String(checks));
      var ec = document.getElementById('stat-checks'); if (ec) ec.textContent = String(checks);

      // avg speed
      var speeds = []; try { speeds = JSON.parse(sessionStorage.getItem('intel_speeds') || '[]'); } catch(e) {}
      speeds.push(parseFloat(elapsed.toFixed(2)));
      if (speeds.length > 20) speeds = speeds.slice(-20);
      sessionStorage.setItem('intel_speeds', JSON.stringify(speeds));
      var avgSpeed = (speeds.reduce(function(a,b){return a+b;},0)/speeds.length).toFixed(1);
      var es = document.getElementById('stat-speed'); if (es) es.textContent = avgSpeed + 's';

      // malicious count from embedded payload
      var rdEl = resultsArea.querySelector('#resultsData');
      if (rdEl) {
        try {
          var rd = JSON.parse(rdEl.textContent || '{}');
          var newMal = parseInt(sessionStorage.getItem('intel_malicious') || '0') + (rd.maliciousCount || 0);
          sessionStorage.setItem('intel_malicious', String(newMal));
          var em = document.getElementById('stat-malicious'); if (em) em.textContent = String(newMal);
        } catch(e) {}
      }

      attachResultHandlers();
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Check Indicator'; }
      resultsArea.innerHTML = '<div class="alert alert-error alert-soft"><span>Error: ' + err.message + '</span></div>';
    }
  }

  document.getElementById('checkForm').addEventListener('submit', handleFormSubmit);

  // ── Post-render button handlers ──────────────────────────────────────────────
  function attachResultHandlers() {
    var resultsArea = document.getElementById('resultsArea');

    var newCheckBtn = resultsArea.querySelector('#newCheckBtn');
    if (newCheckBtn) {
      newCheckBtn.addEventListener('click', function () {
        resultsArea.innerHTML = '<div class="alert alert-info alert-soft"><span>Ready for new check</span></div>';
        var inp = document.getElementById('indicatorsInput');
        inp.value = '';
        updateModeFromInput();
        inp.focus();
      });
    }

    // Copy table as TSV to clipboard
    var copyTableBtn = resultsArea.querySelector('#copyTableBtn');
    if (copyTableBtn) {
      copyTableBtn.addEventListener('click', function () {
        var table = resultsArea.querySelector('#resultsTable');
        if (!table) return;
        var rows = Array.from(table.querySelectorAll('tr'));
        var tsv = rows.map(function (row) {
          return Array.from(row.querySelectorAll('th,td')).map(function (cell) {
            return (cell.getAttribute('title') || cell.textContent || '').trim();
          }).join('\\t');
        }).join('\\n');
        navigator.clipboard.writeText(tsv).then(function () {
          copyTableBtn.textContent = '\\u2713 Copied!';
          setTimeout(function () { copyTableBtn.textContent = '\\uD83D\\uDCCB Copy to Clipboard'; }, 2000);
        }).catch(function (e) { console.error('Copy failed', e); });
      });
    }

    // Export table as CSV download
    var exportCsvBtn = resultsArea.querySelector('#exportCsvBtn');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', function () {
        var table = resultsArea.querySelector('#resultsTable');
        if (!table) return;
        var rows = Array.from(table.querySelectorAll('tr'));
        var csv = rows.map(function (row) {
          return Array.from(row.querySelectorAll('th,td')).map(function (cell) {
            var text = ((cell.getAttribute('title') || cell.textContent || '').trim()).replace(/"/g, '""');
            return '"' + text + '"';
          }).join(',');
        }).join('\\n');
        var blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'intel_results_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // Copy Formatted IP: (IP (Hostname, CC), ...
    var copyPtmBtn = resultsArea.querySelector('#copyPtmBtn');
    if (copyPtmBtn) {
      copyPtmBtn.addEventListener('click', function () {
        var el = resultsArea.querySelector('#resultsData');
        if (!el) return;
        try {
          var data = JSON.parse(el.textContent || '{}');
          var src = data.source;
          var entries = (data.results || []).map(function (r) {
            if (!r.result) return null;
            var ip = '', hostname = '', cc = '';
            if (src === 'AbuseIPDB') {
              ip = r.result.ipAddress || r.indicator;
              hostname = (r.result.hostnames && r.result.hostnames[0]) || r.result.domain || '-';
              cc = r.result.countryCode || '-';
            } else if (src === 'VirusTotal') {
              ip = r.result.id || r.indicator;
              hostname = r.result.rdap_name || '-';
              cc = r.result.country || '-';
            } else {
              ip = r.indicator; hostname = '-'; cc = '-';
            }
            return ip + ' (' + hostname + ',' + cc + ')';
          }).filter(Boolean);
          navigator.clipboard.writeText(entries.join(', ')).then(function () {
            copyPtmBtn.textContent = '\\u2713 Copied!';
            setTimeout(function () { copyPtmBtn.textContent = '\\uD83D\\uDD17 Copy Formatted IP'; }, 2000);
          });
        } catch (e) { console.error('Copy Formatted IP failed', e); }
      });
    }
  }
  // ── Load session stats on init ───────────────────────────────────────────────
  (function loadSessionStats() {
    var checks = sessionStorage.getItem('intel_checks');
    var ec = document.getElementById('stat-checks'); if (ec && checks) ec.textContent = checks;
    var speeds = []; try { speeds = JSON.parse(sessionStorage.getItem('intel_speeds') || '[]'); } catch(e) {}
    var es = document.getElementById('stat-speed');
    if (es && speeds.length > 0) {
      var avg = (speeds.reduce(function(a,b){return a+b;},0)/speeds.length).toFixed(1);
      es.textContent = avg + 's';
    }
    var mal = sessionStorage.getItem('intel_malicious');
    var em = document.getElementById('stat-malicious'); if (em && mal) em.textContent = mal;
  })();

})();
          `,
        }}
      />
    </div>,
    // @ts-expect-error — Hono ContextRenderer not extended; title is picked up by renderer.tsx
    { title: 'Threat Intelligence' }
  )
})

export default intelligence

