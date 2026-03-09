# KOMCAD — Command of Cyber & Active Defense

A lightweight cybersecurity operations dashboard built on **Hono** + **DaisyUI** running on **Cloudflare Workers/Pages**.

---

## Features

| Module | Description |
|---|---|
| **News Hub** | Aggregates cybersecurity news from 5 RSS feeds (HN, BleepingComputer, Dark Reading, Krebs, SANS ISC). Client-side cache (30-min), source + threat-level filters. |
| **Threat Intelligence** | Multi-source IP/hash/domain analysis via AbuseIPDB, VirusTotal, and AlienVault OTX. Combined Analysis (max 10 indicators) and unlimited Bulk mode. Copy Formatted IP output. |
| **Bulk Whois** | Batch IP geolocation via ipinfo.io Lite API. Paste multiple IPs (one per line) and get a full table with org, city, region, country, and timezone. |
| **Report** | Send a report/feedback email via SMTP using the in-app modal (requires SMTP env vars). |

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
| `IPINFO_API_KEY` | Yes (for Bulk Whois) | ipinfo.io API token |
| `SMTP_HOST` | Optional (for Report form) | SMTP server hostname |
| `SMTP_PORT` | Optional | SMTP port (e.g. 587) |
| `SMTP_USER` | Optional | SMTP username |
| `SMTP_PASS` | Optional | SMTP password |
| `SMTP_FROM` | Optional | Sender address |
| `REPORT_TO` | Optional | Recipient address for reports |

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
    rss.ts           # RSS feed aggregation + parsing
    whois.ts         # ipinfo.io IP lookup
    mailer.ts        # SMTP email via nodemailer
  routes/
    intelligence.tsx # Threat Intelligence page
    whois.tsx        # Bulk Whois page
    dashboard-mock.tsx
    api.ts
public/
  static/            # Static assets
```

---

## Need Help?

Visit the project repository: [github.com/gansbeud/komcad](https://github.com/gansbeud/komcad/)

---

## Changelog

### 2025-07
- Added **Bulk Whois** page — batch IP lookup via textarea, IP-only, parallel fetching
- Threat Intelligence: Combined Analysis capped at 10 indicators per run; Bulk Mode has no limit
- News Hub: Removed Read More/Less toggle — descriptions shown directly; fixed abbreviation-based sentence truncation
- Copy Formatted IP output now produces `IP (hostname,CC), ...` format (no extra parenthesis or leading space)
- Removed search bar from navbar
- Cleaned up tooltip text on alerts bell and profile button
- Added GitHub link to Need Help section in Threat Intelligence

### 2025-06
- Initial public release
- News Hub with 5 RSS sources, source/threat filters, localStorage cache
- Threat Intelligence: AbuseIPDB + VirusTotal + OTX, Combined Analysis mode
- Single Whois IP/domain lookup
- Report modal with SMTP support
- htmx-based SPA navigation with breadcrumbs
