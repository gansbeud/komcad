/**
 * Auth event logger — writes NDJSON (one JSON object per line) to logs/auth.log
 *
 * Schema is designed for direct SQL migration:
 *
 * CREATE TABLE auth_logs (
 *   id                  TEXT    PRIMARY KEY,   -- UUID v4
 *   created_at          TEXT    NOT NULL,       -- ISO 8601 UTC
 *   event               TEXT    NOT NULL,       -- 'login_success' | 'login_failure' | 'logout'
 *   username            TEXT    NOT NULL,       -- attempted or actual username
 *   ip                  TEXT    NOT NULL,       -- client IP address
 *   user_agent          TEXT    NOT NULL,       -- browser User-Agent
 *   reason              TEXT,                  -- failure reason (NULL on success)
 *   session_expires_at  TEXT                   -- ISO 8601 UTC (NULL on failure/logout)
 * );
 */

export type AuthEvent = 'login_success' | 'login_failure' | 'logout'

export interface AuthLogEntry {
  id:                 string        // UUID v4
  created_at:         string        // ISO 8601 UTC
  event:              AuthEvent
  username:           string
  ip:                 string
  user_agent:         string
  reason:             string | null // null on success
  session_expires_at: string | null // ISO 8601 UTC on login_success, null otherwise
}

const LOG_PATH = 'logs/auth.log'

export async function logAuthEvent(
  event: AuthEvent,
  username: string,
  request: Request,
  opts: { reason?: string; sessionExpiresAt?: Date } = {}
): Promise<void> {
  const entry: AuthLogEntry = {
    id:                 crypto.randomUUID(),
    created_at:         new Date().toISOString(),
    event,
    username:           username || '(empty)',
    ip:                 getClientIp(request),
    user_agent:         request.headers.get('user-agent') || '',
    reason:             opts.reason ?? null,
    session_expires_at: opts.sessionExpiresAt ? opts.sessionExpiresAt.toISOString() : null,
  }

  const line = JSON.stringify(entry) + '\n'

  // Write to file in Node.js / Vite dev environment.
  // In Cloudflare Workers, node:fs is unavailable — fall through to console.log.
  try {
    const { appendFile, mkdir } = await import('node:fs/promises')
    await mkdir('logs', { recursive: true })
    await appendFile(LOG_PATH, line, 'utf8')
  } catch {
    // Production / Workers runtime: emit to console so logs are visible in
    // Cloudflare's Logpush / Workers Logs dashboard.
    console.log('[auth-log]', line.trim())
  }
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
