/**
 * Check event logger — writes to D1 check_logs table
 * Falls back to console.log in Workers environment (captured by Logpush)
 *
 * Logs intelligence checks (IP/domain/hash queries) and WHOIS queries
 */

import type { D1Database } from 'hono';
import { execute, nowISO } from './db';
import { generateUUID } from './crypto';

export interface CheckLogEntry {
  id: string;
  user_id: string;
  service: string;
  mode: string;
  source: string;
  indicator: string;
  result: string;
  summary_json: string;
  is_malicious: number | null;
  ip_address: string;
  created_at: string;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function getUserAgent(req: Request): string {
  return req.headers.get('user-agent') ?? 'unknown';
}

/**
 * Log a single check event to D1 or console
 * @param service - Service type (abuseipdb, virustotal, otx, threatfox, ipinfo, whois, etc.)
 * @param mode - Mode (single, bulk, combined, whois)
 * @param source - Source identifier
 * @param indicator - The IP/domain/hash that was checked
 * @param result - Result as JSON string (full API response or verdict)
 * @param summary - Summary JSON with { status, scores, reports, pulses, malware_indicators, tags, etc. }
 * @param isMalicious - 1 if malicious, 0 if safe, null if unknown
 * @param userId - User ID who performed the check
 * @param request - Request object to extract IP and User-Agent
 * @param opts - Additional options (db)
 */
export async function logCheckEvent(
  service: string,
  mode: string,
  source: string,
  indicator: string,
  result: string,
  summary: string,
  isMalicious: number | null,
  userId: string,
  request: Request,
  opts: { db?: D1Database } = {}
): Promise<void> {
  const entry: CheckLogEntry = {
    id: generateUUID(),
    user_id: userId,
    service,
    mode,
    source,
    indicator: indicator || '(empty)',
    result,
    summary_json: summary,
    is_malicious: isMalicious,
    ip_address: getClientIp(request),
    created_at: nowISO(),
  };

  // Try to write to D1
  if (opts.db) {
    try {
      await execute(
        opts.db,
        `
        INSERT INTO check_logs 
        (id, user_id, service, mode, source, indicator, result, summary_json, is_malicious, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          entry.id,
          entry.user_id,
          entry.service,
          entry.mode,
          entry.source,
          entry.indicator,
          entry.result,
          entry.summary_json,
          entry.is_malicious,
          entry.ip_address,
          entry.created_at,
        ]
      );
    } catch (error) {
      console.error('Failed to log check event to D1:', error);
      // Fall through to console.log
    }
  }

  // Console fallback (for Workers environment or if D1 fails)
  const logLine = JSON.stringify(entry);
  console.log('[check-log]', logLine);
}

/**
 * Log multiple check events at once (e.g. bulk mode or combined analysis)
 * Fires inserts concurrently
 */
export async function logCheckEvents(
  service: string,
  mode: string,
  source: string,
  indicators: Array<{
    indicator: string;
    result: 'success' | 'error';
    summary?: string;
    detail?: string;
    is_malicious?: number | null;
  }>,
  request: Request,
  opts: { user_id?: string; db?: D1Database } = {}
): Promise<void> {
  const userId = opts.user_id ?? 'unknown';
  
  await Promise.all(
    indicators.map((item) =>
      logCheckEvent(
        service,
        mode,
        source,
        item.indicator,
        JSON.stringify({ result: item.result, detail: item.detail }),
        item.summary ?? '{}',
        item.is_malicious ?? null,
        userId,
        request,
        { db: opts.db }
      )
    )
  );
}
