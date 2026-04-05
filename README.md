# KOMCAD — Command of Cyber & Active Defense

A lightweight cybersecurity operations dashboard built on **Hono** + **DaisyUI** running on **Cloudflare Workers/Pages**.

---

## Features

| Module | Description |
|---|---|
| **News Hub** | Aggregates cybersecurity news from 5 RSS feeds (HN, BleepingComputer, Dark Reading, Krebs, SANS ISC). Client-side cache (30-min), source + threat-level filters. |
| **Threat Intelligence** | Multi-source IP/hash/domain/URL analysis via **AbuseIPDB**, **VirusTotal**, **AlienVault OTX**, and **ThreatFOX**. Combined Analysis (max 10 indicators, 2 for demo) with card-based per-indicator verdict summary and correlation panel. Unlimited Bulk Mode (max 5 for demo). Copy Formatted IP output. |
| **Bulk Whois** | Batch IP geolocation via ipinfo.io Lite API. Paste multiple IPs (one per line) and get a full table with org, city, region, country, and timezone. |
| **Report** | Send a report/feedback email via SMTP using the in-app modal (requires SMTP env vars). Rate-limited to 3 submissions per IP per hour. |

---

## Tech Stack

- **[Hono](https://hono.dev/)** v4 — edge-first JSX/SSR framework
- **[DaisyUI](https://daisyui.com/)** v5 + **[Tailwind CSS](https://tailwindcss.com/)** v4 — component styling
- **[htmx](https://htmx.org/)** 2.0 — SPA-style navigation without a full frontend framework
- **[Vite](https://vite.dev/)** + `@hono/vite-build` — build toolchain
- **Cloudflare Workers/Pages** — deployment target
- **nodemailer** — SMTP email for report form
- **ipinfo.io Lite API** — IP geolocation

---

## Setup

### Prerequisites

- Node.js ≥ 18
- A Cloudflare account (or just use `wrangler dev` locally)

### Install

```bash
git clone https://github.com/gansbeud/komcad.git
cd komcad
npm install
```

### Configure environment

Copy the example env file and fill in your API keys:

```bash
cp .env.local.example .env.local   # or create manually
```

**.env.local**

| Variable | Required | Description |
|---|---|---|
| `VIRUSTOTAL_API_KEY` | Yes (for VT lookups) | VirusTotal API key |
| `ABUSEIPDB_API_KEY` | Yes (for AbuseIPDB lookups) | AbuseIPDB API key |
| `OTX_API_KEY` | Yes (for OTX lookups) | AlienVault OTX API key |
| `THREATFOX_API_KEY` | Optional | ThreatFOX API key from [abuse.ch](https://threatfox.abuse.ch/api/). Works without a key but at a lower rate limit. |
| `IPINFO_API_KEY` | Yes (for Bulk Whois) | ipinfo.io API token |
| `SMTP_HOST` | Optional (for Report form) | SMTP server hostname |
| `SMTP_PORT` | Optional | SMTP port (e.g. 587) |
| `SMTP_USER` | Optional | SMTP username |
| `SMTP_PASS` | Optional | SMTP password |
| `SMTP_FROM` | Optional | Sender address |
| `REPORT_TO` | Optional | Recipient address for reports |
| `JWT_SECRET` | Yes | Secret for signing session tokens |
| `ADMIN_USER` | Yes | Admin account username |
| `ADMIN_PASS` | Yes | Admin account password |
| `DEMO_USER` | Optional | Demo account username |
| `DEMO_PASS` | Optional | Demo account password |
| `DEMO_RATE_BULK_MAX` | Optional | Max indicators per Bulk Mode request for demo accounts (default: `5`) |
| `DEMO_RATE_COMBINED_MAX` | Optional | Max indicators per Combined Analysis request for demo accounts (default: `2`) |

### Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Build for production

```bash
npm run build
```

### Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy dist
```

---

## Project Structure

```
src/
  index.tsx          # App entry, News Hub page + API routes
  renderer.tsx       # Shared layout (sidebar, navbar, modals)
  style.css          # Tailwind + DaisyUI imports
  lib/
    abuseipdb.ts     # AbuseIPDB API client
    virustotal.ts    # VirusTotal API client
    otx.ts           # AlienVault OTX API client
    threatfox.ts     # ThreatFOX API client (abuse.ch)
    rss.ts           # RSS feed aggregation + parsing
    whois.ts         # ipinfo.io IP lookup
    mailer.ts        # SMTP email via nodemailer
  routes/
    intelligence.tsx # Threat Intelligence page
    whois.tsx        # Bulk Whois page
    auth.tsx         # Login/logout + JWT session
    auditlog.tsx     # Admin audit log viewer
    api.ts           # Misc API helpers
public/
  static/            # Static assets
```

---

## Security

- **Authentication**: JWT HS256, 8-hour sessions, `httpOnly` + `SameSite=Lax` cookies
- **Login rate-limiting**: Max 10 failed attempts per IP per 15-minute window
- **Report form rate-limiting**: Max 3 submissions per IP per hour
- **Input validation**: Server-side indicator length limits (500 chars each, 50,000 total)
- **Demo account limits**: Configurable via `DEMO_RATE_BULK_MAX` / `DEMO_RATE_COMBINED_MAX`
- **XSS**: JSON data embedded in `<script>` tags has `</script` escaped to prevent tag injection

> **Note**: In-memory rate limiters reset on Worker restart. For production deployments requiring persistent cross-isolate rate limiting, use [Cloudflare Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/) or Cloudflare KV.

---

## Need Help?

Visit the project repository: [github.com/gansbeud/komcad](https://github.com/gansbeud/komcad/)

---

## Changelog

### v4
- Added **ThreatFOX** (abuse.ch) as 4th threat intelligence engine — supports IP, domain, hash, URL lookups
- **Combined Analysis**: redesigned result view with card-based per-indicator verdict summary, correlation panel with malware family aggregation, and collapsible detail table
- Added **demo account rate limiting** — configurable max indicators for Bulk and Combined Analysis modes (`DEMO_RATE_BULK_MAX`, `DEMO_RATE_COMBINED_MAX`)
- Security hardening: login brute-force protection (10 attempts / 15 min per IP), report form SMTP spam protection (3 submissions / hour per IP), server-side input length validation, XSS fix in script tag data embedding, double-submit prevention on check form

### Earlier
- Added **Bulk Whois** page — batch IP lookup via textarea, IP-only, parallel fetching
- Threat Intelligence: Combined Analysis capped at 10 indicators per run; Bulk Mode has no limit
- News Hub: Removed Read More/Less toggle — descriptions shown directly; fixed abbreviation-based sentence truncation
- Copy Formatted IP output now produces `IP (hostname,CC), ...` format (no extra parenthesis or leading space)
- Removed search bar from navbar
- Cleaned up tooltip text on alerts bell and profile button
- Added GitHub link to Need Help section in Threat Intelligence

- Initial public release
- News Hub with 5 RSS sources, source/threat filters, localStorage cache
- Threat Intelligence: AbuseIPDB + VirusTotal + OTX, Combined Analysis mode
- Single Whois IP/domain lookup
- Report modal with SMTP support
- htmx-based SPA navigation with breadcrumbs


👍👍