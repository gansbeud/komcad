/**
 * Auth event logger — writes to D1 auth_logs table
 * Falls back to console.log in Workers environment (captured by Logpush)
 *
 * Events: login_success, login_failure, logout, session_create, session_expire
 */

import type { D1Database } from 'hono';
import { execute, nowISO } from './db';
import { generateUUID } from './crypto';

export type AuthEvent = 'login_success' | 'login_failure' | 'logout' | 'session_create' | 'session_expire'

export interface AuthLogEntry {
  id: string;
  user_id: string | null;
  event: AuthEvent;
  ip_address: string;
  user_agent: string;
  failure_reason: string | null;
  created_at: string;
  session_id: string | null;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function getUserAgent(req: Request): string {
  return req.headers.get('user-agent') ?? 'unknown'
}

/**
 * Log an authentication event to D1 or console
 * @param event - Type of auth event
 * @param userId - User ID (null for failed logins where user doesn't exist)
 * @param request - Request object to extract IP and User-Agent
 * @param opts - Additional options (db, failure_reason, session_id)
 */
export async function logAuthEvent(
  event: AuthEvent,
  userId: string | null,
  request: Request,
  opts: { 
    db?: D1Database;
    reason?: string;
    ip?: string;
    sessionId?: string;
    [key: string]: unknown;
  } = {}
): Promise<void> {
  const entry: AuthLogEntry = {
    id: generateUUID(),
    user_id: userId,
    event,
    ip_address: opts.ip || getClientIp(request),
    user_agent: getUserAgent(request),
    failure_reason: opts.reason ?? null,
    created_at: nowISO(),
    session_id: opts.sessionId ?? null,
  };

  // Try to write to D1
  if (opts.db) {
    try {
      await execute(
        opts.db,
        `
        INSERT INTO auth_logs (id, user_id, event, ip_address, user_agent, failure_reason, created_at, session_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          entry.id,
          entry.user_id,
          entry.event,
          entry.ip_address,
          entry.user_agent,
          entry.failure_reason,
          entry.created_at,
          entry.session_id,
        ]
      );
    } catch (error) {
      console.error('Failed to log auth event to D1:', error);
      // Fall through to console.log
    }
  }

  // Console fallback (for Workers environment or if D1 fails)
  const logLine = JSON.stringify(entry);
  console.log('[auth-log]', logLine);
}
