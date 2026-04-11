-- Komcad Consolidated Migration
-- Created: 2026-04-11
-- Purpose: Complete database schema setup for authentication, sessions, and audit logging
-- This single migration replaces file-based NDJSON logs and env-var auth with D1-backed persistent storage

-- ============================================================================
-- TABLE 1: users
-- ============================================================================
-- Stores user credentials (hashed) and basic account info
-- Replaces: ADMIN_USER, ADMIN_PASS, DEMO_USER, DEMO_PASS env vars
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',  -- 'admin', 'demo', 'user'
  created_at TEXT NOT NULL,           -- ISO 8601 timestamp
  updated_at TEXT,                    -- ISO 8601 timestamp (track modifications)
  last_login_at TEXT,                 -- ISO 8601 timestamp, NULL if never logged in
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================================
-- TABLE 2: sessions
-- ============================================================================
-- Replaces JWT-only design with persistent session tracking
-- Enables: logout across all devices, session management, brute-force detection
-- JWT still in cookie, but validated against this table on each request
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                -- UUID session ID
  user_id TEXT NOT NULL,              -- Foreign key to users table
  token_hash TEXT NOT NULL UNIQUE,    -- SHA-256 hash of JWT token (never store plaintext)
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  created_at TEXT NOT NULL,           -- ISO 8601 timestamp
  expires_at TEXT NOT NULL,           -- ISO 8601 timestamp (8 hours from creation)
  last_activity_at TEXT NOT NULL,     -- ISO 8601 timestamp, update on each request
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);

-- ============================================================================
-- TABLE 3: auth_logs
-- ============================================================================
-- Replaces: logs/auth.log (NDJSON)
-- Events: login_success, login_failure, logout, session_expire
CREATE TABLE IF NOT EXISTS auth_logs (
  id TEXT PRIMARY KEY,                -- UUID
  user_id TEXT,                       -- NULL for failed logins (user didn't exist)
  event TEXT NOT NULL,                -- 'login_success', 'login_failure', 'logout', 'session_create'
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  failure_reason TEXT,                -- NULL if success. e.g., 'invalid_password', 'user_not_found', 'account_disabled'
  created_at TEXT NOT NULL,           -- ISO 8601 timestamp
  session_id TEXT,                    -- NULL for logout/failed logins
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_event ON auth_logs(event);
CREATE INDEX IF NOT EXISTS idx_auth_logs_ip_address ON auth_logs(ip_address);

-- ============================================================================
-- TABLE 4: check_logs
-- ============================================================================
-- Replaces: logs/check.log (NDJSON)
-- Logs all intelligence checks (IP, domain, hash) and WHOIS queries
CREATE TABLE IF NOT EXISTS check_logs (
  id TEXT PRIMARY KEY,                -- UUID
  user_id TEXT NOT NULL,              -- Foreign key to users table
  service TEXT NOT NULL,              -- 'abuseipdb', 'virustotal', 'otx', 'threatfox', 'ipinfo', 'whois', etc.
  mode TEXT NOT NULL,                 -- 'single', 'bulk', 'combined'
  source TEXT NOT NULL,               -- 'intelligence', 'whois', etc.
  indicator TEXT NOT NULL,            -- The IP/domain/hash that was checked
  result TEXT NOT NULL,               -- JSON: full API response or verdict
  summary_json TEXT NOT NULL,         -- JSON: {status, scores, reports, pulses, malware_indicators, tags}
  is_malicious INTEGER,               -- 1 if any service flagged as malicious, 0 if safe, NULL if unknown
  ip_address TEXT NOT NULL,
  created_at TEXT NOT NULL,           -- ISO 8601 timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_check_logs_user_id ON check_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_check_logs_created_at ON check_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_logs_indicator ON check_logs(indicator);
CREATE INDEX IF NOT EXISTS idx_check_logs_service ON check_logs(service);
CREATE INDEX IF NOT EXISTS idx_check_logs_is_malicious ON check_logs(is_malicious);

-- ============================================================================
-- TABLE 5: rate_limits
-- ============================================================================
-- Replaces: In-memory Map() for rate limiting
-- Persists across Worker isolate restarts
-- 15-minute rolling window for login attempts per IP + endpoint
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,                -- Unique key: 'ip:user_id:endpoint'
  ip_address TEXT NOT NULL,
  user_id TEXT,                       -- NULL for failed login attempts (user not found)
  endpoint TEXT NOT NULL,             -- e.g., '/api/auth/login', '/api/check'
  attempt_count INTEGER NOT NULL DEFAULT 1,
  window_start_at TEXT NOT NULL,      -- ISO 8601 timestamp (start of 15-min window)
  created_at TEXT NOT NULL,           -- ISO 8601 timestamp (when first attempt was recorded)
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON rate_limits(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at ON rate_limits(created_at);

-- ============================================================================
-- SEED DATA: Initialize users table with admin and demo accounts
-- ============================================================================
INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at, updated_at, is_active)
VALUES 
  ('604a7d2e-2a54-474c-8bae-8fdd90979790', 'admin', 'EjAaVFKQSFfjL1xpaCAYwsC/lUGj1g1W103WErIM5IGepk+cgmvbPS+UtZEkH2wc', 'admin', '2026-04-11T07:04:41.527Z', '2026-04-11T07:04:41.527Z', 1),
  ('1a59f1fc-0b02-4129-94d7-952c85aedf19', 'demo', 'aVKo5REh+/QCbEC9NoDt18hS+UM576orvMXyKBZMO6PV82N1mqYkXVYtgX46RQ2+', 'demo', '2026-04-11T07:04:41.527Z', '2026-04-11T07:04:41.527Z', 1);

-- ============================================================================
-- CLEANUP: Auto-delete expired sessions (optional, can be done via cron)
-- ============================================================================
-- Note: Can be run as a scheduled task or Durable Object cron
-- DELETE FROM sessions WHERE expires_at < datetime('now') AND is_active = 1;
-- DELETE FROM rate_limits WHERE window_start_at < datetime('now', '-15 minutes');
