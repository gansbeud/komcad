/**
 * Check event logger — writes NDJSON (one JSON object per line) to logs/check.log
 *
 * Schema is designed for direct SQL migration:
 *
 * CREATE TABLE check_logs (
 *   id           TEXT    PRIMARY KEY,  -- UUID v4
 *   created_at   TEXT    NOT NULL,     -- ISO 8601 UTC
 *   service      TEXT    NOT NULL,     -- 'intelligence' | 'whois'
 *   mode         TEXT    NOT NULL,     -- e.g. 'Single Mode', 'Bulk Mode', 'Combined Analysis', 'whois'
 *   source       TEXT    NOT NULL,     -- e.g. 'AbuseIPDB', 'VirusTotal', 'OTX Alienvault', 'AbuseIPDB,VirusTotal', 'ipinfo.io'
 *   indicator    TEXT    NOT NULL,     -- the queried value (IP/domain/hash)
 *   result       TEXT    NOT NULL,     -- 'success' | 'error'
 *   detail       TEXT,                 -- error message or NULL on success
 *   summary      TEXT,                 -- JSON string of key result metrics (verdict, score, etc.) or NULL on error
 *   username     TEXT    NOT NULL,     -- logged-in user who ran the check
 *   ip           TEXT    NOT NULL      -- client IP
 * );
 */

export type CheckService = 'intelligence' | 'whois'

export interface CheckLogEntry {
  id:          string
  created_at:  string
  service:     CheckService
  mode:        string
  source:      string
  indicator:   string
  result:      'success' | 'error'
  detail:      string | null
  summary:     string | null
  username:    string
  ip:          string
}

const LOG_PATH = 'logs/check.log'

export async function logCheckEvent(
  service: CheckService,
  mode: string,
  source: string,
  indicator: string,
  result: 'success' | 'error',
  request: Request,
  opts: { detail?: string; summary?: string | null; username?: string } = {}
): Promise<void> {
  const entry: CheckLogEntry = {
    id:         crypto.randomUUID(),
    created_at: new Date().toISOString(),
    service,
    mode,
    source,
    indicator:  indicator || '(empty)',
    result,
    detail:     opts.detail ?? null,
    summary:    opts.summary ?? null,
    username:   opts.username ?? 'unknown',
    ip:         getClientIp(request),
  }

  const line = JSON.stringify(entry) + '\n'

  try {
    const { appendFile, mkdir } = await import('node:fs/promises')
    await mkdir('logs', { recursive: true })
    await appendFile(LOG_PATH, line, 'utf8')
  } catch {
    console.log('[check-log]', line.trim())
  }
}

/**
 * Log multiple indicators at once (e.g. bulk mode or combined analysis).
 * Fires one log entry per indicator concurrently.
 */
export async function logCheckEvents(
  service: CheckService,
  mode: string,
  source: string,
  indicators: { indicator: string; result: 'success' | 'error'; detail?: string; summary?: string | null }[],
  request: Request,
  opts: { username?: string } = {}
): Promise<void> {
  await Promise.all(
    indicators.map((item) =>
      logCheckEvent(service, mode, source, item.indicator, item.result, request, {
        detail:   item.detail,
        summary:  item.summary,
        username: opts.username,
      })
    )
  )
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
