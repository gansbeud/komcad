import { Hono } from 'hono'

const auditlog = new Hono()

// ── helpers ──────────────────────────────────────────────────────────────────

async function readNDJSON(path: string): Promise<any[]> {
  try {
    const { readFile } = await import('node:fs/promises')
    const text = await readFile(path, 'utf8')
    return text
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => {
        try { return JSON.parse(l) } catch { return null }
      })
      .filter(Boolean)
      .reverse() // newest first
  } catch {
    return []
  }
}

function eventBadge(event: string) {
  if (event === 'login_success') return <span class="badge badge-success badge-sm">login_success</span>
  if (event === 'login_failure') return <span class="badge badge-error badge-sm">login_failure</span>
  if (event === 'logout')        return <span class="badge badge-neutral badge-sm">logout</span>
  return <span class="badge badge-ghost badge-sm">{event}</span>
}

function resultBadge(result: string) {
  if (result === 'success') return <span class="badge badge-success badge-sm">success</span>
  if (result === 'error')   return <span class="badge badge-error badge-sm">error</span>
  return <span class="badge badge-ghost badge-sm">{result}</span>
}

function verdictBadge(summary: string | null) {
  if (!summary) return <span class="text-xs opacity-40">—</span>
  try {
    const s = JSON.parse(summary)
    // Combined: may have abdb, vt, otx keys; Single: status directly/nested
    const statuses: string[] = []
    if (s.status) statuses.push(s.status)
    if (s.abdb?.status) statuses.push(s.abdb.status)
    if (s.vt?.status)   statuses.push(s.vt.status)
    if (s.otx?.status)  statuses.push(s.otx.status)
    if (s.tfox?.status) statuses.push(s.tfox.status)
    if (statuses.length === 0) return <span class="text-xs opacity-40">—</span>
    const worst = statuses.includes('malicious') ? 'malicious'
                : statuses.includes('suspicious') ? 'suspicious'
                : 'clean'
    if (worst === 'malicious') return <span class="badge badge-error badge-sm font-bold">malicious</span>
    if (worst === 'suspicious') return <span class="badge badge-warning badge-sm font-bold">suspicious</span>
    return <span class="badge badge-success badge-sm">clean</span>
  } catch {
    return <span class="text-xs opacity-40">—</span>
  }
}

function summaryText(summary: string | null): string {
  if (!summary) return '—'
  try {
    const s = JSON.parse(summary)
    const parts: string[] = []
    if (s.score  !== undefined) parts.push(`score: ${s.score}`)
    if (s.reports !== undefined) parts.push(`reports: ${s.reports}`)
    if (s.pulses  !== undefined) parts.push(`pulses: ${s.pulses}`)
    if (s.malicious !== undefined) parts.push(`malicious: ${s.malicious}`)
    if (s.country   !== undefined && s.org !== undefined) parts.push(`${s.country} / ${s.org}`)
    else if (s.country !== undefined) parts.push(`country: ${s.country}`)
    else if (s.org     !== undefined) parts.push(`org: ${s.org}`)
    if (s.abdb || s.vt || s.otx || s.tfox) {
      if (s.abdb) parts.push(`ABDB: ${s.abdb.status ?? ''}(${s.abdb.score ?? ''})`)
      if (s.vt)   parts.push(`VT: ${s.vt.status ?? ''}(mal:${s.vt.malicious ?? ''})`)
      if (s.otx)  parts.push(`OTX: ${s.otx.status ?? ''}(${s.otx.pulses ?? ''} pulses)`)
      if (s.tfox) parts.push(`TFX: ${s.tfox.status ?? ''}(${s.tfox.malware ?? '—'})`)
    }
    return parts.length > 0 ? parts.join(' | ') : JSON.stringify(s)
  } catch {
    return summary
  }
}

// ── GET /auditlog ─────────────────────────────────────────────────────────────

auditlog.get('/auditlog', async (c) => {
  const [authEvents, checkEvents] = await Promise.all([
    readNDJSON('logs/auth.log'),
    readNDJSON('logs/check.log'),
  ])

  const totalAuth  = authEvents.length
  const totalCheck = checkEvents.length
  const totalFail  = authEvents.filter((e) => e.event === 'login_failure').length
  const totalMal   = checkEvents.filter((e) => {
    if (!e.summary) return false
    try {
      const s = JSON.parse(e.summary)
      const statuses = [s.status, s.abdb?.status, s.vt?.status, s.otx?.status].filter(Boolean)
      return statuses.includes('malicious')
    } catch { return false }
  }).length

  return c.render(
    <div class="space-y-6">
      {/* PAGE HEADER */}
      <div>
        <h1 class="text-4xl font-bold mb-2">Audit Log</h1>
        <p class="text-base-content/70">
          Authentication events and indicator check history — admin only
        </p>
      </div>

      {/* STATS */}
      <div class="grid gap-2 sm:gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <div class="stat bg-base-100 shadow-sm border border-base-300 rounded-lg py-3 sm:py-4">
          <div class="stat-figure text-xl sm:text-2xl">🔐</div>
          <div class="stat-title text-xs opacity-70">Auth Events</div>
          <div class="stat-value text-xl sm:text-2xl">{totalAuth}</div>
        </div>
        <div class="stat bg-base-100 shadow-sm border border-base-300 rounded-lg py-3 sm:py-4">
          <div class="stat-figure text-xl sm:text-2xl">⚠️</div>
          <div class="stat-title text-xs opacity-70">Failed Logins</div>
          <div class="stat-value text-xl sm:text-2xl text-error">{totalFail}</div>
        </div>
        <div class="stat bg-base-100 shadow-sm border border-base-300 rounded-lg py-3 sm:py-4">
          <div class="stat-figure text-xl sm:text-2xl">🔍</div>
          <div class="stat-title text-xs opacity-70">Check Events</div>
          <div class="stat-value text-xl sm:text-2xl">{totalCheck}</div>
        </div>
        <div class="stat bg-base-100 shadow-sm border border-base-300 rounded-lg py-3 sm:py-4">
          <div class="stat-figure text-xl sm:text-2xl">🚨</div>
          <div class="stat-title text-xs opacity-70">Malicious Hits</div>
          <div class="stat-value text-xl sm:text-2xl text-error">{totalMal}</div>
        </div>
      </div>

      {/* TABS */}
      <div role="tablist" class="tabs tabs-lift">
        {/* ── AUTH EVENTS TAB ────────────────────────────────────────────── */}
        <input type="radio" name="audit_tabs" class="tab" aria-label={`Auth Events (${totalAuth})`} checked />
        <div class="tab-content bg-base-100 border-base-300 rounded-box p-4 space-y-3">
          {authEvents.length === 0
            ? <div class="alert alert-soft"><span>No auth events logged yet. Events are written to <code>logs/auth.log</code>.</span></div>
            : <div class="overflow-x-auto">
                <table class="table table-xs table-zebra w-full">
                  <thead>
                    <tr class="border-base-300">
                      <th>#</th>
                      <th>Timestamp</th>
                      <th>Event</th>
                      <th>Username</th>
                      <th>IP</th>
                      <th>User Agent</th>
                      <th>Reason / Session Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {authEvents.map((e: any, i: number) => (
                      <tr key={e.id} class={e.event === 'login_failure' ? 'bg-error/5' : ''}>
                        <td class="opacity-40 text-xs">{totalAuth - i}</td>
                        <td class="whitespace-nowrap text-xs">{e.created_at ? new Date(e.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' WIB' : '—'}</td>
                        <td>{eventBadge(e.event)}</td>
                        <td class="font-mono text-xs">{e.username ?? '—'}</td>
                        <td class="font-mono text-xs">{e.ip ?? '—'}</td>
                        <td class="text-xs max-w-xs truncate opacity-60" title={e.user_agent}>{e.user_agent ? e.user_agent.slice(0, 60) + (e.user_agent.length > 60 ? '…' : '') : '—'}</td>
                        <td class="text-xs opacity-70">{e.reason ?? (e.session_expires_at ? `expires ${e.session_expires_at}` : '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>

        {/* ── CHECK EVENTS TAB ───────────────────────────────────────────── */}
        <input type="radio" name="audit_tabs" class="tab" aria-label={`Check Events (${totalCheck})`} />
        <div class="tab-content bg-base-100 border-base-300 rounded-box p-4 space-y-3">
          {checkEvents.length === 0
            ? <div class="alert alert-soft"><span>No check events logged yet. Events are written to <code>logs/check.log</code>.</span></div>
            : <div class="overflow-x-auto">
                <table class="table table-xs table-zebra w-full">
                  <thead>
                    <tr class="border-base-300">
                      <th>#</th>
                      <th>Timestamp</th>
                      <th>Service</th>
                      <th>Mode</th>
                      <th>Source</th>
                      <th>Indicator</th>
                      <th>Result</th>
                      <th>Verdict</th>
                      <th>Summary</th>
                      <th>User</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkEvents.map((e: any, i: number) => (
                      <tr key={e.id} class={e.result === 'error' ? 'bg-error/5' : ''}>
                        <td class="opacity-40 text-xs">{totalCheck - i}</td>
                        <td class="whitespace-nowrap text-xs">{e.created_at ? new Date(e.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' WIB' : '—'}</td>
                        <td><span class="badge badge-outline badge-sm">{e.service ?? '—'}</span></td>
                        <td class="text-xs">{e.mode ?? '—'}</td>
                        <td class="text-xs font-mono">{e.source ?? '—'}</td>
                        <td class="font-mono text-xs">{e.indicator ?? '—'}</td>
                        <td>{resultBadge(e.result)}</td>
                        <td>{verdictBadge(e.summary)}</td>
                        <td class="text-xs opacity-70 max-w-xs">{e.result === 'error' ? (e.detail ?? '—') : summaryText(e.summary)}</td>
                        <td class="font-mono text-xs">{e.username ?? '—'}</td>
                        <td class="font-mono text-xs">{e.ip ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      </div>
    </div>,
    // @ts-expect-error — Hono ContextRenderer not extended; title picked up by renderer.tsx
    { title: 'Audit Log' }
  )
})

export default auditlog
