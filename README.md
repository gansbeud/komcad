# KOMCAD

Command of Cyber and Active Defense, built with Hono, DaisyUI, and Cloudflare Pages/Workers.

This README is now the single top-level source of truth for setup, deployment, migration, operations, and troubleshooting.

## Overview

KOMCAD provides:

- Cybersecurity news aggregation from RSS sources
- Threat intelligence checks (AbuseIPDB, VirusTotal, OTX, ThreatFox)
- Bulk WHOIS/IP enrichment via ipinfo
- Audit visibility for auth/check events in D1
- Admin user management UI
- Report/contact submission by SMTP

## Tech Stack

- Hono 4
- DaisyUI 5 + Tailwind CSS 4
- htmx 2
- Vite + @hono/vite-build
- Cloudflare Pages/Workers + D1
- nodemailer

## Runtime Architecture

### Route map

- Public auth routes: `/login`, `/logout` via auth router
- Authenticated pages: `/`, `/news`, `/intelligence`, `/whois`
- Admin pages:
  - `/admin/auditlog`
  - `/admin/manage`
- API routes under `/api`

### Route conflict policy

Admin modules are mounted on distinct prefixes to avoid silent overlap:

- Audit router is mounted under `/admin/auditlog`
- User-management router is mounted under `/admin/manage`

Do not reintroduce shared broad mounts for multiple admin routers.

## Database and Auth Model

Current source of truth:

- Users are stored in D1 (`users` table)
- Sessions are tracked in D1 (`sessions` table) with JWT validation
- Auth logs and check logs are stored in D1 (`auth_logs`, `check_logs`)
- Rate-limit state is stored in D1 (`rate_limits`)

Credentials are not sourced from `ADMIN_USER`, `ADMIN_PASS`, `DEMO_USER`, or `DEMO_PASS` environment variables.
Admin/demo accounts are seeded by migration SQL and managed through the admin interface.

## Prerequisites

- Node.js 18+
- npm
- Cloudflare account and Wrangler CLI for deploy workflows

## Local Development

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Build production bundle:

```bash
npm run build
```

## Environment and Secrets

### Local

Use `.env.local` for local development values.

### Cloudflare secrets

Set required secrets with Wrangler:

```bash
wrangler secret put ABUSEIPDB_API_KEY
wrangler secret put VIRUSTOTAL_API_KEY
wrangler secret put OTX_API_KEY
wrangler secret put THREATFOX_API_KEY
wrangler secret put IPINFO_API_KEY
wrangler secret put JWT_SECRET
wrangler secret put SMTP_HOST
wrangler secret put SMTP_PORT
wrangler secret put SMTP_USER
wrangler secret put SMTP_PASS
wrangler secret put SMTP_FROM
wrangler secret put REPORT_TO
```

Optional non-secret tuning:

- `DEMO_RATE_BULK_MAX` (default 5)
- `DEMO_RATE_COMBINED_MAX` (default 2)

## Migration

Canonical migration path uses:

- `src/db/migrations/001_consolidated_schema.sql`

Apply migration:

```bash
wrangler d1 execute komcad --file src/db/migrations/001_consolidated_schema.sql
```

Verify tables:

```bash
wrangler d1 execute komcad --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Expected core tables:

- `users`
- `sessions`
- `auth_logs`
- `check_logs`
- `rate_limits`

## Deployment

Build and deploy:

```bash
npm run build
npx wrangler pages deploy dist
```

Local Pages preview (optional):

```bash
npx wrangler pages dev dist --local
```

## Security Controls (Current)

- JWT auth via httpOnly cookie
- Admin authorization guard for `/admin/*`
- Login rate limiting
- D1-backed auth and check audit logs
- D1-backed rate-limit persistence
- Server-side input length checks for intelligence requests

## Operations Runbook

Common cleanup tasks:

```bash
# Expired/inactive sessions
wrangler d1 execute komcad --command "DELETE FROM sessions WHERE expires_at < datetime('now') OR is_active = 0;"

# Stale rate-limit windows
wrangler d1 execute komcad --command "DELETE FROM rate_limits WHERE window_start_at < datetime('now', '-15 minutes');"

# Old auth logs (example retention: 90 days)
wrangler d1 execute komcad --command "DELETE FROM auth_logs WHERE created_at < datetime('now', '-90 days');"
```

## Troubleshooting

### Migration issues

- Confirm D1 binding and database ID in `wrangler.jsonc`
- Verify target DB exists with `wrangler d1 list`
- Re-run verification queries for table/index existence

### Login/auth issues

- Confirm `JWT_SECRET` is set in deployment environment
- Confirm seeded/admin users exist in `users`
- Check `sessions` and `auth_logs` for failures

### External provider failures

- Verify API keys are set via Cloudflare secrets
- Verify route can read bindings from `c.env`

## Repository Layout

```text
src/
  index.tsx
  renderer.tsx
  style.css
  lib/
    abuseipdb.ts
    virustotal.ts
    otx.ts
    threatfox.ts
    whois.ts
    mailer.ts
    db.ts
    session.ts
    authlog.ts
    checklog.ts
    ratelimit-db.ts
  routes/
    auth.tsx
    api.ts
    intelligence.tsx
    whois.tsx
    auditlog.tsx
    admin-manage.tsx
  db/
    migrations/
      001_consolidated_schema.sql
```

## Historical Doc Consolidation

The following top-level documents were merged into this README and removed:

- `DEPLOYMENT_CHECKLIST.md`
- `DEPLOYMENT_ENV_GUIDE.md`
- `GETTING_STARTED.md`
- `INDEX.md`
- `MIGRATION_COMPLETE.md`
- `MIGRATION_SUMMARY.md`

For database details, use the single DB document at `src/db/README.md`.
