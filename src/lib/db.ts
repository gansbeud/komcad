/**
 * D1 Database Utilities
 * Provides helpers for D1 database operations and connection management
 */

import type { D1Database, Context } from 'hono';

/**
 * Get D1 database binding from Hono context
 * Supports both Cloudflare Workers (c.env) and local dev (fallback)
 */
export function getDB(c: Context): D1Database {
  const env = c.env as Record<string, unknown>;
  const db = env.KOMCAD_DB as D1Database | undefined;
  
  if (!db) {
    throw new Error('D1 database binding not found. Ensure KOMCAD_DB is configured in wrangler.jsonc');
  }
  
  return db;
}

/**
 * Execute a SELECT query and return all rows
 */
export async function query<T>(db: D1Database, sql: string, params?: unknown[]): Promise<T[]> {
  try {
    const stmt = db.prepare(sql);
    const response = params ? await stmt.bind(...params).all() : await stmt.all();
    return (response.results || []) as T[];
  } catch (error) {
    console.error('D1 Query Error:', error, { sql, params });
    throw error;
  }
}

/**
 * Execute a SELECT query and return a single row
 */
export async function queryOne<T>(db: D1Database, sql: string, params?: unknown[]): Promise<T | null> {
  const results = await query<T>(db, sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Execute an INSERT/UPDATE/DELETE query and return metadata
 */
export async function execute(
  db: D1Database,
  sql: string,
  params?: unknown[]
): Promise<{ success: boolean; changes?: number; lastRowId?: number }> {
  try {
    const stmt = db.prepare(sql);
    const response = params ? await stmt.bind(...params).run() : await stmt.run();
    return {
      success: response.success,
      changes: response.meta?.changes,
      lastRowId: response.meta?.last_row_id,
    };
  } catch (error) {
    console.error('D1 Execute Error:', error, { sql, params });
    throw error;
  }
}

/**
 * Execute multiple statements in a transaction
 */
export async function transaction(
  db: D1Database,
  queries: Array<{ sql: string; params?: unknown[] }>
): Promise<void> {
  try {
    // Note: D1 doesn't have explicit transaction support in the current API
    // Execute sequentially and throw on first error
    for (const { sql, params } of queries) {
      await execute(db, sql, params);
    }
  } catch (error) {
    console.error('D1 Transaction Error:', error);
    throw error;
  }
}

/**
 * Check if table exists
 */
export async function tableExists(db: D1Database, tableName: string): Promise<boolean> {
  const result = await queryOne<{ name: string }>(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    [tableName]
  );
  return result !== null;
}

/**
 * Get table row count
 */
export async function getRowCount(db: D1Database, tableName: string): Promise<number> {
  const result = await queryOne<{ count: number }>(db, `SELECT COUNT(*) as count FROM ${tableName}`);
  return result?.count || 0;
}

/**
 * Paginate query results
 */
export async function paginate<T>(
  db: D1Database,
  sql: string,
  page: number = 1,
  limit: number = 20,
  params?: unknown[]
): Promise<{
  data: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}> {
  // Count total
  const countSql = `SELECT COUNT(*) as count FROM (${sql})`;
  const countResult = await queryOne<{ count: number }>(db, countSql, params);
  const total = countResult?.count || 0;

  // Paginate
  const offset = (page - 1) * limit;
  const paginatedSql = `${sql} LIMIT ? OFFSET ?`;
  const allParams = [...(params || []), limit, offset];
  const data = await query<T>(db, paginatedSql, allParams);

  return {
    data,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

/**
 * Format ISO 8601 timestamp (used throughout the app)
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Check if a timestamp is in the past
 */
export function isPast(isoTimestamp: string): boolean {
  return new Date(isoTimestamp) < new Date();
}

/**
 * Add minutes to current time and return ISO timestamp
 */
export function addMinutesISO(minutes: number): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

/**
 * Add hours to current time and return ISO timestamp
 */
export function addHoursISO(hours: number): string {
  return addMinutesISO(hours * 60);
}
