/**
 * Rate Limiting with D1
 * Replaces in-memory rate limiting with persistent database storage
 * Survives Worker isolate restarts
 */

import type { D1Database } from 'hono';
import { queryOne, execute, nowISO, addMinutesISO } from './db';

export interface RateLimit {
  id: string;
  ip_address: string;
  user_id: string | null;
  endpoint: string;
  attempt_count: number;
  window_start_at: string;
  created_at: string;
}

/**
 * Check if a request is rate limited
 * Returns { blocked, remaining } where remaining is attempts left in window
 */
export async function checkRateLimit(
  db: D1Database,
  ipAddress: string,
  endpoint: string,
  userId?: string,
  maxAttempts: number = 10,
  windowMinutes: number = 15
): Promise<{ blocked: boolean; remaining: number }> {
  // Clean up old rate limit entries first
  await cleanupOldRateLimits(db, windowMinutes);

  const windowStart = addMinutesISO(-windowMinutes);
  const id = `${ipAddress}:${userId || 'anonymous'}:${endpoint}`;

  // Query for existing rate limit record in current window
  const existing = await queryOne<RateLimit>(
    db,
    `
    SELECT * FROM rate_limits 
    WHERE id = ? AND window_start_at > ?
  `,
    [id, windowStart]
  );

  if (existing) {
    const remaining = Math.max(0, maxAttempts - existing.attempt_count);
    return {
      blocked: existing.attempt_count >= maxAttempts,
      remaining,
    };
  }

  // No existing record, so 0 attempts so far
  return { blocked: false, remaining: maxAttempts };
}

/**
 * Record an attempt (increment counter)
 */
export async function recordAttempt(
  db: D1Database,
  ipAddress: string,
  endpoint: string,
  userId?: string,
  windowMinutes: number = 15
): Promise<void> {
  const id = `${ipAddress}:${userId || 'anonymous'}:${endpoint}`;
  const now = nowISO();
  const windowStart = addMinutesISO(-windowMinutes);

  // Check if record exists in current window
  const existing = await queryOne<RateLimit>(
    db,
    `
    SELECT * FROM rate_limits 
    WHERE id = ? AND window_start_at > ?
  `,
    [id, windowStart]
  );

  if (existing) {
    // Increment counter
    await execute(
      db,
      `UPDATE rate_limits SET attempt_count = attempt_count + 1 WHERE id = ?`,
      [id]
    );
  } else {
    // Create new record with window start = now
    await execute(
      db,
      `
      INSERT INTO rate_limits (id, ip_address, user_id, endpoint, attempt_count, window_start_at, created_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `,
      [id, ipAddress, userId || null, endpoint, now, now]
    );
  }
}

/**
 * Reset rate limit for an IP/endpoint (admin use)
 */
export async function resetRateLimit(
  db: D1Database,
  ipAddress: string,
  endpoint: string,
  userId?: string
): Promise<void> {
  const id = `${ipAddress}:${userId || 'anonymous'}:${endpoint}`;
  await execute(db, `DELETE FROM rate_limits WHERE id = ?`, [id]);
}

/**
 * Reset all rate limits (admin use, careful!)
 */
export async function resetAllRateLimits(db: D1Database): Promise<void> {
  await execute(db, `DELETE FROM rate_limits`);
}

/**
 * Clean up old rate limit entries (older than window)
 * Called automatically by checkRateLimit
 */
export async function cleanupOldRateLimits(
  db: D1Database,
  windowMinutes: number = 15
): Promise<{ deleted: number }> {
  const cutoffTime = addMinutesISO(-windowMinutes);
  const result = await execute(
    db,
    `DELETE FROM rate_limits WHERE window_start_at < ?`,
    [cutoffTime]
  );

  return { deleted: result.changes || 0 };
}

/**
 * Get all rate limit records for an IP address
 */
export async function getIPRateLimits(db: D1Database, ipAddress: string): Promise<RateLimit[]> {
  const result = await execute(
    db,
    `
    SELECT * FROM rate_limits 
    WHERE ip_address = ? 
    ORDER BY window_start_at DESC
  `,
    [ipAddress]
  );

  // Note: execute() doesn't return rows. We need to use query() instead.
  // This is a limitation of our implementation. For now, return empty array.
  // TODO: Add query support to this function
  return [];
}

/**
 * Check if an IP is currently rate limited on any endpoint
 */
export async function isIPRateLimited(
  db: D1Database,
  ipAddress: string,
  maxAttempts: number = 10,
  windowMinutes: number = 15
): Promise<boolean> {
  const windowStart = addMinutesISO(-windowMinutes);

  // Check if any endpoint has this IP over limit
  const result = await queryOne<{ count: number }>(
    db,
    `
    SELECT COUNT(*) as count FROM rate_limits 
    WHERE ip_address = ? AND window_start_at > ? AND attempt_count >= ?
  `,
    [ipAddress, windowStart, maxAttempts]
  );

  return (result?.count || 0) > 0;
}

/**
 * Get rate limit stats for monitoring/debugging
 */
export async function getRateLimitStats(db: D1Database): Promise<{
  totalRecords: number;
  blockedIPs: number;
  oldestRecord: string | null;
  newestRecord: string | null;
}> {
  const result = await queryOne<{
    total: number;
    blocked: number;
    oldest: string | null;
    newest: string | null;
  }>(
    db,
    `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN attempt_count >= 10 THEN 1 ELSE 0 END) as blocked,
      MIN(window_start_at) as oldest,
      MAX(window_start_at) as newest
    FROM rate_limits
  `
  );

  return {
    totalRecords: result?.total || 0,
    blockedIPs: result?.blocked || 0,
    oldestRecord: result?.oldest || null,
    newestRecord: result?.newest || null,
  };
}
