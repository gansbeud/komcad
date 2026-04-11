import { Hono } from 'hono'
import { getDB, query } from '../lib/db'

const auditlog = new Hono()

// ── Helpers ──────────────────────────────────────────────────────────────────

function eventBadge(event: string) {
  if (event === 'login_success') return <span class="badge badge-success badge-sm">login_success</span>
  if (event === 'login_failure') return <span class="badge badge-error badge-sm">login_failure</span>
  if (event === 'logout')        return <span class="badge badge-neutral badge-sm">logout</span>
  return <span class="badge badge-ghost badge-sm">{event}</span>
}

function resultBadge(isMalicious: number | null) {
  if (isMalicious === 1) return <span class="badge badge-error badge-sm">🚨 malicious</span>
  if (isMalicious === 0) return <span class="badge badge-success badge-sm">✓ safe</span>
  return <span class="badge badge-ghost badge-sm">—</span>
}

function verdictBadge(summary: string | null) {
  if (!summary) return <span class="text-xs opacity-40">—</span>
  try {
    const s = JSON.parse(summary)
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

interface AuthLogRow {
  id: string
  user_id: string | null
  event: string
  ip_address: string
  user_agent: string
  failure_reason: string | null
  created_at: string
  session_id: string | null
}

interface CheckLogRow {
  id: string
  user_id: string
  service: string
  mode: string
  source: string
  indicator: string
  result: string  // Add missing result column
  summary_json: string
  is_malicious: number | null
  ip_address: string
  created_at: string
}

interface UserRow {
  id: string
  username: string
}

// ── GET /admin/auditlog ───────────────────────────────────────────────────────

auditlog.get('/', async (c) => {
  try {
    const db = getDB(c)

    const authEvents = await query<AuthLogRow>(
      db,
      'SELECT * FROM auth_logs ORDER BY created_at DESC LIMIT 1000'
    )

    const checkEvents = await query<CheckLogRow>(
      db,
      'SELECT * FROM check_logs ORDER BY created_at DESC LIMIT 1000'
    )

    const users = await query<UserRow>(db, 'SELECT id, username FROM users')
    const userMap = Object.fromEntries(users.map(u => [u.id, u.username]))

    const totalAuth  = authEvents.length
    const totalCheck = checkEvents.length
    const totalFail  = authEvents.filter((e) => e.event === 'login_failure').length
    const totalMal   = checkEvents.filter((e) => e.is_malicious === 1).length

    return c.render(
      <div class="space-y-6">
        <div>
          <h1 class="text-4xl font-bold mb-2">Audit Log</h1>
          <p class="text-base-content/70">
            Authentication events and indicator check history — stored in D1
          </p>
        </div>

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

        <div role="tablist" class="tabs tabs-lift">
          <input type="radio" name="audit_tabs" class="tab" aria-label={`Auth Events (${totalAuth})`} checked />
          <div class="tab-content bg-base-100 border-base-300 rounded-box p-4 space-y-3">
            {authEvents.length === 0
              ? <div class="alert alert-soft"><span>No auth events logged yet.</span></div>
              : <div class="overflow-x-auto">
                  <table class="table table-xs table-zebra w-full">
                    <thead>
                      <tr class="border-base-300">
                        <th>#</th><th>Timestamp</th><th>Event</th><th>User</th><th>IP</th><th>User Agent</th><th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {authEvents.map((e: AuthLogRow, i: number) => (
                        <tr key={e.id} class={e.event === 'login_failure' ? 'bg-error/5' : ''}>
                          <td class="opacity-40 text-xs">{totalAuth - i}</td>
                          <td class="whitespace-nowrap text-xs">{e.created_at ? new Date(e.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' WIB' : '—'}</td>
                          <td>{eventBadge(e.event)}</td>
                          <td class="font-mono text-xs">{e.user_id ? (userMap[e.user_id] || e.user_id) : '—'}</td>
                          <td class="font-mono text-xs">{e.ip_address ?? '—'}</td>
                          <td class="text-xs max-w-xs truncate opacity-60" title={e.user_agent}>{e.user_agent ? e.user_agent.slice(0, 60) + (e.user_agent.length > 60 ? '…' : '') : '—'}</td>
                          <td class="text-xs opacity-70">{e.failure_reason ?? e.session_id ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>

          <input type="radio" name="audit_tabs" class="tab" aria-label={`Check Events (${totalCheck})`} />
          <div class="tab-content bg-base-100 border-base-300 rounded-box p-4 space-y-3">
            {checkEvents.length === 0
              ? <div class="alert alert-soft"><span>No check events logged yet.</span></div>
              : <div class="overflow-x-auto">
                  <table class="table table-xs table-zebra w-full">
                    <thead>
                      <tr class="border-base-300">
                        <th>#</th><th>Timestamp</th><th>Service</th><th>Mode</th><th>Source</th><th>Indicator</th><th>Status</th><th>Verdict</th><th>Summary</th><th>User</th><th>IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkEvents.map((e: CheckLogRow, i: number) => (
                        <tr key={e.id} class={e.is_malicious === 1 ? 'bg-error/5' : ''}>
                          <td class="opacity-40 text-xs">{totalCheck - i}</td>
                          <td class="whitespace-nowrap text-xs">{e.created_at ? new Date(e.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' WIB' : '—'}</td>
                          <td><span class="badge badge-outline badge-sm">{e.service ?? '—'}</span></td>
                          <td class="text-xs">{e.mode ?? '—'}</td>
                          <td class="text-xs font-mono">{e.source ?? '—'}</td>
                          <td class="font-mono text-xs">{e.indicator ?? '—'}</td>
                          <td>{resultBadge(e.is_malicious)}</td>
                          <td>{verdictBadge(e.summary_json)}</td>
                          <td class="text-xs opacity-70 max-w-xs">{summaryText(e.summary_json)}</td>
                          <td class="font-mono text-xs">{e.user_id ? (userMap[e.user_id] || e.user_id) : '—'}</td>
                          <td class="font-mono text-xs">{e.ip_address ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        </div>
      </div>,
      { title: 'Audit Log' }
    )
  } catch (error) {
    console.error('Audit log error:', error)
    return c.render(
      <div class="space-y-4">
        <h1 class="text-4xl font-bold mb-2">Audit Log</h1>
        <div class="alert alert-error">
          <span>Error loading audit logs: {error instanceof Error ? error.message : 'Unknown error'}</span>
        </div>
      </div>,
      { title: 'Audit Log - Error' }
    )
  }
})

export default auditlog
