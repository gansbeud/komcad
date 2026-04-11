/**
 * Session Management
 * Create, validate, and manage user sessions stored in D1
 */

import type { D1Database } from 'hono';
import { query, queryOne, execute, nowISO, addHoursISO } from './db';
import { createJWT, verifyJWT, hashToken, generateUUID } from './crypto';

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  expires_at: string;
  last_activity_at: string;
  is_active: number;
}

export interface JWTPayload {
  sub: string; // user_id
  user: string; // username
  role: string; // user role (admin, demo, etc.)
  sid: string; // session_id
  iat: number;
  exp: number;
}

/**
 * Create a new session for a user
 * Returns the JWT token to be stored in a cookie
 */
export async function createSession(
  db: D1Database,
  userId: string,
  username: string,
  role: string,
  ipAddress: string,
  userAgent: string,
  jwtSecret: string,
  expiresInHours: number = 8
): Promise<{ token: string; sessionId: string }> {
  const sessionId = generateUUID();
  const now = nowISO();
  const expiresAt = addHoursISO(expiresInHours);

  // Create JWT token with user info
  const jwtPayload: JWTPayload = {
    sub: userId,
    user: username,
    role: role,
    sid: sessionId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(new Date(expiresAt).getTime() / 1000),
  };

  const token = await createJWT(jwtPayload, jwtSecret, expiresInHours * 3600);
  const tokenHash = await hashToken(token);

  // Store session in database
  await execute(
    db,
    `
    INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, created_at, expires_at, last_activity_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `,
    [sessionId, userId, tokenHash, ipAddress, userAgent, now, expiresAt, now]
  );

  return { token, sessionId };
}

/**
 * Validate a session token
 * Returns the session if valid, null otherwise
 */
export async function validateSession(
  db: D1Database,
  token: string,
  secret: string
): Promise<{ session: Session; payload: JWTPayload } | null> {
  // Verify JWT signature and expiration
  const jwtVerify = await verifyJWT(token, secret);
  if (!jwtVerify.valid || !jwtVerify.payload) {
    return null;
  }

  const payload = jwtVerify.payload as unknown as JWTPayload;
  const tokenHash = await hashToken(token);

  // Look up session in database
  const session = await queryOne<Session>(
    db,
    `
    SELECT * FROM sessions 
    WHERE id = ? AND token_hash = ? AND is_active = 1 AND expires_at > ?
  `,
    [payload.sid, tokenHash, nowISO()]
  );

  if (!session) {
    return null;
  }

  return { session, payload };
}

/**
 * Update session last_activity_at timestamp
 * Call this on every authenticated request
 */
export async function updateSessionActivity(db: D1Database, sessionId: string): Promise<void> {
  await execute(db, 'UPDATE sessions SET last_activity_at = ? WHERE id = ?', [nowISO(), sessionId]);
}

/**
 * Mark a single session as inactive (logout)
 */
export async function expireSession(db: D1Database, sessionId: string): Promise<void> {
  await execute(db, 'UPDATE sessions SET is_active = 0 WHERE id = ?', [sessionId]);
}

/**
 * Mark all sessions for a user as inactive (logout from all devices)
 * Optional: exclude a specific session
 */
export async function expireUserSessions(
  db: D1Database,
  userId: string,
  exceptSessionId?: string
): Promise<void> {
  if (exceptSessionId) {
    await execute(
      db,
      'UPDATE sessions SET is_active = 0 WHERE user_id = ? AND id != ?',
      [userId, exceptSessionId]
    );
  } else {
    await execute(db, 'UPDATE sessions SET is_active = 0 WHERE user_id = ?', [userId]);
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(db: D1Database, userId: string): Promise<Session[]> {
  return query<Session>(
    db,
    `
    SELECT * FROM sessions 
    WHERE user_id = ? AND is_active = 1 AND expires_at > ?
    ORDER BY last_activity_at DESC
  `,
    [userId, nowISO()]
  );
}

/**
 * Clean up expired sessions (can be called periodically)
 */
export async function cleanupExpiredSessions(db: D1Database): Promise<{ deleted: number }> {
  const result = await execute(
    db,
    `DELETE FROM sessions WHERE expires_at < ? OR is_active = 0`,
    [nowISO()]
  );

  return { deleted: result.changes || 0 };
}

/**
 * Get session by ID
 */
export async function getSession(db: D1Database, sessionId: string): Promise<Session | null> {
  return queryOne<Session>(
    db,
    `
    SELECT * FROM sessions 
    WHERE id = ? AND is_active = 1 AND expires_at > ?
  `,
    [sessionId, nowISO()]
  );
}

/**
 * Count active sessions for a user
 */
export async function countUserActiveSessions(db: D1Database, userId: string): Promise<number> {
  const result = await queryOne<{ count: number }>(
    db,
    `
    SELECT COUNT(*) as count FROM sessions 
    WHERE user_id = ? AND is_active = 1 AND expires_at > ?
  `,
    [userId, nowISO()]
  );

  return result?.count || 0;
}
