# KOMCAD DB Reference

This is the single documentation file for the database layer.

## Canonical Migration

Use only this migration file:

- `src/db/migrations/001_consolidated_schema.sql`

It contains:

- full schema for `users`, `sessions`, `auth_logs`, `check_logs`, `rate_limits`
- indexes for common access patterns
- seed users (`admin`, `demo`) in the same file

## Apply Migration

```bash
wrangler d1 execute komcad --file src/db/migrations/001_consolidated_schema.sql
```

## Verify

```bash
wrangler d1 execute komcad --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Expected tables:

- `auth_logs`
- `check_logs`
- `rate_limits`
- `sessions`
- `users`

## Runtime Source Of Truth

- Authentication and roles come from the `users` table
- Session validity comes from `sessions` plus JWT verification
- Auth events are in `auth_logs`
- Check history is in `check_logs`
- Rate-limit windows are in `rate_limits`

Environment credentials like `ADMIN_USER` and `ADMIN_PASS` are not the runtime auth source.

## Operational Cleanup

```bash
# Expired/inactive sessions
wrangler d1 execute komcad --command "DELETE FROM sessions WHERE expires_at < datetime('now') OR is_active = 0;"

# Stale rate-limit windows
wrangler d1 execute komcad --command "DELETE FROM rate_limits WHERE window_start_at < datetime('now', '-15 minutes');"

# Optional auth log retention
wrangler d1 execute komcad --command "DELETE FROM auth_logs WHERE created_at < datetime('now', '-90 days');"
```

## Notes

- Keep migrations consolidated unless a real incremental migration is needed.
- If you add a new migration later, keep seed data strategy explicit and avoid duplicate seed paths.