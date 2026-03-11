# KOMCAD — Command of Cyber & Active Defense

A full-stack cybersecurity operations dashboard built on **Hono** + **DaisyUI** running on **Cloudflare Workers/Pages**.

**Status**: ✅ Production Ready | **Version**: 1.0 | **Last Updated**: March 2026

---

## 🎯 Overview

KOMCAD provides security teams with a single pane of glass for:
- **Real-time threat intelligence aggregation** from multiple sources
- **Cybersecurity news feeds** from top industry sources
- **IP/domain/hash reputation checking** via AbuseIPDB, VirusTotal, and OTX
- **Bulk geolocation lookups** for IP addresses
- **Secure authentication** with JWT tokens and role-based access

---

## ⚡ Core Features

| Module | Description | Status |
|--------|---|:---:|
| **Dashboard** | Security overview with alerts, threat timeline, and system status (under development) | 🚧 |
| **News Hub** | Aggregates cybersecurity news from 5 RSS feeds (HN, BleepingComputer, Dark Reading, Krebs, SANS ISC). Client-side cache (30-min), source + threat-level filters. | ✅ |
| **Threat Intelligence** | Multi-source IP/hash/domain/URL analysis via **AbuseIPDB**, **VirusTotal**, **AlienVault OTX**. Single/Bulk/Combined Analysis modes. | ✅ |
| **Bulk Whois** | Batch IP geolocation via ipinfo.io Lite API. | ✅ |
| **Admin Panel** | Audit log viewer (admin-only) | ✅ |
| **Authentication** | JWT-based session management with rate-limited login | ✅ |

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|---|---|
| **Backend** | [Hono](https://hono.dev/) v4 + TypeScript | Edge-first JSX/SSR framework |
| **Styling** | [DaisyUI](https://daisyui.com/) v5 + [Tailwind CSS](https://tailwindcss.com/) v4 | Component library & utilities |
| **Frontend** | [htmx](https://htmx.org/) 2.0 | SPA-style navigation without JS framework |
| **Build** | [Vite](https://vite.dev/) + `@hono/vite-build` | Fast module bundling |
| **Deployment** | Cloudflare Workers/Pages | Global edge computing |
| **External APIs** | VirusTotal, AbuseIPDB, OTX, ipinfo.io, RSS feeds | Threat data sources |
| **Email** | nodemailer + SMTP | Report submission |
| **Auth** | Hono JWT + cookies | Session management |

---

## 📋 Prerequisites

- **Node.js** ≥ 18
- **Cloudflare account** (free tier works) or `wrangler` for local dev
- **API keys** (see [Getting API Keys](#-getting-api-keys))

---

## 🚀 Quick Start (5 Minutes)

### 1. Clone & Install

```bash
git clone https://github.com/gansbeud/komcad.git
cd komcad
npm install
```

### 2. Get API Keys

Visit these sites and copy your free tier API keys:
- **AbuseIPDB**: https://www.abuseipdb.com/api
- **VirusTotal**: https://www.virustotal.com/gui/my-apikey  
- **OTX Alienvault**: https://otx.alienvault.com/
- **ipinfo.io**: https://ipinfo.io/account/home (optional, for Bulk Whois)

### 3. Configure Environment

```bash
# Create .env.local in project root
cat > .env.local << 'EOF'
# Threat Intelligence APIs
VIRUSTOTAL_API_KEY=your_virustotal_key
ABUSEIPDB_API_KEY=your_abuseipdb_key
OTX_API_KEY=your_otx_key

# IP Geolocation (optional)
IPINFO_API_KEY=your_ipinfo_key

# Email (optional, for report form)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@komcad.local
REPORT_TO=security@company.local

# Authentication
JWT_SECRET=your_random_secret_here
ADMIN_USER=administrator
ADMIN_PASS=your_secure_password
DEMO_USER=demo
DEMO_PASS=demo123
EOF
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

- **Admin user**: (use credentials from .env.local)
- **Demo user**: demo / demo123

### 5. Test It

- **News Hub**: `/news` — RSS feed aggregation with filters
- **Intelligence**: `/intelligence` — Threat checker
- **Bulk Whois**: `/whois` — IP geolocation batch lookup
- **Admin Panel**: `/admin/auditlog` — Login audit trail (admin only)

---

## 🔑 Getting API Keys

### AbuseIPDB (IPv4 Reputation)
1. Visit https://www.abuseipdb.com/register
2. Sign up or log in
3. Go to https://www.abuseipdb.com/api → Generate API key
4. **Free tier**: 1,000 requests/day

### VirusTotal (Multi-Engine Malware Scanning)
1. Visit https://www.virustotal.com/gui/home/upload
2. Sign up or log in
3. Go to https://www.virustotal.com/gui/my-apikey
4. **Free tier**: 4 req/min, 500/day

### OTX / Alienvault (Threat Intelligence Pulses)
1. Visit https://otx.alienvault.com/
2. Sign up or log in
3. Go to Settings → Copy API Key
4. **Free tier**: Unlimited

### ipinfo.io (Optional — IP Geolocation)
1. Visit https://ipinfo.io/
2. Sign up or log in
3. Go to Account → Copy API token
4. **Free tier**: 50k requests/month

---

## 📁 Project Structure

```
komcad/
├── src/
│   ├── index.tsx                 # Main app + route mounting
│   ├── renderer.tsx              # Layout (navbar, sidebar, footer)
│   ├── style.css                 # Global styles
│   ├── lib/                      # Utilities & API integrations
│   │   ├── abuseipdb.ts         # AbuseIPDB integration
│   │   ├── virustotal.ts        # VirusTotal integration
│   │   ├── otx.ts               # OTX Alienvault integration
│   │   ├── whois.ts             # IP geolocation (ipinfo.io)
│   │   ├── rss.ts               # RSS feed fetcher
│   │   ├── mailer.ts            # Email sender (nodemailer)
│   │   ├── authlog.ts           # Auth event logging
│   │   ├── checklog.ts          # Intelligence check logging
│   │   └── threatfox.ts         # ThreatFOX integration (optional)
│   └── routes/
│       ├── auth.tsx             # Login/logout/register
│       ├── dashboard-mock.tsx   # Dashboard (under development)
│       ├── news.tsx             # News Hub (/news)
│       ├── intelligence.tsx     # Threat Intelligence (/intelligence)
│       ├── whois.tsx            # Bulk Whois (/whois)
│       ├── auditlog.tsx         # Admin audit log
│       └── api.ts               # API check endpoint
├── vite.config.ts               # Vite build config
├── tsconfig.json                # TypeScript config
├── wrangler.jsonc               # Cloudflare Workers config
├── .env.local                   # API keys (create this!)
├── .env.local.example           # Template
├── .gitignore                   # Updated (excludes .env.local)
└── README.md                    # This file

```

---

## 🔧 Environment Variables

**All variables**: See [Environment Configuration](#-environment-configuration) section below.

---

## 👤 Authentication

### Built-in Users

- **Admin Account** (via `ADMIN_USER` / `ADMIN_PASS`)
  - Full access to all features
  - Can view audit logs at `/admin/auditlog`
  - Rate limits don't apply

- **Demo Account** (via `DEMO_USER` / `DEMO_PASS`)
  - Limited to:
    - Max `DEMO_RATE_BULK_MAX` indicators per Bulk check (default: 5)
    - Max `DEMO_RATE_COMBINED_MAX` indicators per Combined check (default: 2)
  - No access to admin panel

### Session Management

- JWT tokens stored in `komcad_token` cookie (httpOnly, Lax, 8-hour expiry)
- Passwords hashed server-side, never transmitted
- Rate limiting: max 10 login attempts per IP per 15 minutes
- All auth events logged to `logs/authlog.ndjson`

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────┐
│            Browser / Frontend                    │
│  (htmx-powered SPA with daisyUI components)    │
└──────────────────┬──────────────────────────────┘
                   │ HTTP / HTMX
                   ▼
┌─────────────────────────────────────────────────┐
│         Hono Edge Server (Cloudflare)            │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐ │
│  │  Auth     │  │  Routes    │  │  Middleware│ │
│  │  (JWT)    │  │  (RPC/SSR) │  │  (Cache)   │ │
│  └───────────┘  └────────────┘  └────────────┘ │
└──────────────────┬──────────────────────────────┘
                   │
      ┌────────────┼────────────┬─────────────┐
      ▼            ▼            ▼             ▼
  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐
  │ Threat  │ │   RSS    │ │ ipinfo │ │ Logging  │
  │  APIs   │ │  Feeds   │ │  /IP   │ │  (files) │
  │ (VT,AI) │ │ (5 feeds)│ │ geoloc │ │          │
  └─────────┘ └──────────┘ └────────┘ └──────────┘
```

### Request Flow (Threat Intelligence Example)

```
1. User enters indicator → Form submission (HTMX POST)
2. Backend validates input & source
3. Selects appropriate API handler (VT/AbuseIPDB/OTX)
4. Calls third-party API with server-side API key
5. Formats result (color-coded status, details)
6. Returns HTML → HTMX swaps into DOM
7. Log check event to checklog.ndjson
```

---

## 📊 Threat Intelligence Module

### Supported Indicators

| Type | AbuseIPDB | VirusTotal | OTX |
|------|:---:|:---:|:---:|
| IPv4 address | ✅ | ✅ | ✅ |
| IPv6 address | ❌ | ✅ | ✅ |
| Domain | ❌ | ✅ | ✅ |
| Hostname | ❌ | ✅ | ✅ |
| URL | ❌ | ✅ | ✅ |
| MD5 hash | ❌ | ✅ | ✅ |
| SHA-1 hash | ❌ | ✅ | ✅ |
| SHA-256 hash | ❌ | ✅ | ✅ |

### Check Modes

| Mode | Input | Use Case | Max |
|------|-------|---|---|
| **Single** | 1 indicator | Quick lookup | 1 |
| **Bulk** | Multiple indicators (one per line) | Batch analysis | 100 (demo: 5) |
| **Combined** | 1-10 indicators | Correlation analysis | 10 (demo: 2) |

**Auto-detection**: Single = 1 line, Bulk = 2+ lines

### Result Status Mapping

Each API returns results mapped to a unified status:

| Status | Color | Meaning | Confidence |
|--------|-------|---------|:---:|
| **Malicious** | 🔴 Red | Confirmed malicious | High |
| **Suspicious** | 🟡 Yellow | Potentially malicious | Medium |
| **Clean** | 🟢 Green | No threats detected | High |
| **Not Found** | ⚪ Gray | No data in database | — |
| **Error** | ❌ Error | API error or unsupported type | — |

### API Details

#### AbuseIPDB
```
Endpoint: https://api.abuseipdb.com/api/v2/check
Auth: Key: {API_KEY}
Method: POST
Rate Limit: 1,000 req/day (free)
Supported: IPv4 only
Details: Risk score (0-100), abuse reports, country, ISP
```

#### VirusTotal
```
Endpoint: https://www.virustotal.com/api/v3/{type}/{indicator}
Auth: x-apikey: {API_KEY}
Method: GET
Rate Limit: 4 req/min, 500/day (free)
Supported: IP, domain, URL, hash
Details: Detection ratio, engines, reputation, tags
```

#### OTX / Alienvault
```
Endpoint: https://otx.alienvault.com/api/v1/indicators/{type}/{indicator}/general
Auth: X-OTX-API-KEY: {API_KEY}
Method: GET
Rate Limit: Unlimited (free)
Supported: IP, domain, hostname, URL, hash
Details: Pulse count, reputation, malware families
```

### Error Handling

- **Invalid indicator type**: Marked as "Not Found"
- **API timeout**: Marked as "Error" 
- **Rate limit hit**: Graceful message
- **Network error**: Retry or skip to next indicator
- **Per-indicator errors**: Don't block other indicators

---

## 📰 News Hub

Aggregates cybersecurity news from 5 RSS feeds:

| Source | URL |
|--------|---|
| The Hacker News | https://thehackernews.com/... |
| BleepingComputer | https://www.bleepingcomputer.com/... |
| Dark Reading | https://www.darkreading.com/... |
| Krebs on Security | https://krebsonsecurity.com/... |
| SANS ISC | https://isc.sans.edu/... |

**Features**:
- Real-time feed aggregation (server-side)
- Client-side caching (30 minutes)
- Filter by source and threat level
- Relative timestamps
- Direct links to articles

---

## 🌐 Bulk Whois

Batch IP geolocation via ipinfo.io Lite API.

**Features**:
- Paste multiple IPs (one per line)
- CSV export
- Org, city, region, country, timezone lookup
- Max: 100 IPs per check

---

## 📋 Environment Configuration

### Full Reference

```bash
# ═══════════════════════════════════════════════════════════════
# THREAT INTELLIGENCE APIs (REQUIRED FOR /intelligence)
# ═══════════════════════════════════════════════════════════════

# AbuseIPDB v2 API - IPv4 reputation
ABUSEIPDB_API_KEY=

# VirusTotal v3 API - Multi-engine scanning
VIRUSTOTAL_API_KEY=

# OTX / Alienvault v1 API - Threat intelligence
OTX_API_KEY=

# ThreatFOX (optional) - File hash tracking
THREATFOX_API_KEY=

# ═══════════════════════════════════════════════════════════════
# IP GEOLOCATION (OPTIONAL - For Bulk Whois)
# ═══════════════════════════════════════════════════════════════
IPINFO_API_KEY=

# ═══════════════════════════════════════════════════════════════
# EMAIL / SMTP (OPTIONAL - For Report form)
# ═══════════════════════════════════════════════════════════════
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@komcad.local
REPORT_TO=security@company.local

# ═══════════════════════════════════════════════════════════════
# AUTHENTICATION (REQUIRED)
# ═══════════════════════════════════════════════════════════════

# Secret for JWT token signing (must be >32 chars)
JWT_SECRET=your-very-secure-random-secret-here-at-least-32-chars

# Admin account (full access)
ADMIN_USER=administrator
ADMIN_PASS=secure_password_here

# Demo account (limited access)
DEMO_USER=demo
DEMO_PASS=demo123

# ═══════════════════════════════════════════════════════════════
# RATE LIMITING (OPTIONAL - for demo account)
# ═══════════════════════════════════════════════════════════════

# Max indicators per bulk check for demo (default: 5)
DEMO_RATE_BULK_MAX=5

# Max indicators per combined check for demo (default: 2)
DEMO_RATE_COMBINED_MAX=2
```

---

## 🖥️ Running Locally

### Development

```bash
# Install dependencies
npm install

# Create .env.local with your API keys
cp .env.local.example .env.local
# Edit .env.local and add your keys

# Start dev server
npm run dev

# Visit http://localhost:5173
```

### Production Build

```bash
# Build for production
npm run build

# Output in ./dist
```

### Deployment

#### Cloudflare Pages

```bash
# Build
npm run build

# Deploy
npx wrangler pages deploy dist
```

#### Self-hosted (Node.js)

```bash
# Build
npm run build

# Run server
node dist/server.js
```

---

## 🔐 Security

### Best Practices

✅ API keys stored in `.env.local` (not version controlled)  
✅ Server-side API calls only (keys never exposed to client)  
✅ Input validation before all API requests  
✅ No persistent storage of check results  
✅ Graceful error handling (no data leakage)  
✅ JWT tokens with short expiry (8 hours)  
✅ Login rate limiting (10 attempts/15 min)  
✅ Auth event logging  
✅ HTTPS recommended for production  

### What's NOT Stored

- API results (stateless design)
- User input indicators
- API response bodies
- Check history (except logs)

### What's Logged

- Login/logout events (authlog.ndjson)
- Intelligence checks (checklog.ndjson)
- Errors (console/stderr)

---

## 🐛 Troubleshooting

### "API Key not configured"

```bash
# 1. Verify .env.local exists
ls -la .env.local

# 2. Verify keys are set (not empty)
grep VIRUSTOTAL_API_KEY .env.local

# 3. Restart dev server
npm run dev
```

### "Not Found" Status on Check

- Indicator type may not be supported by selected source
- Try a different source
- Check indicator format (proper IP, domain, etc.)

### Rate Limit Exceeded

- AbuseIPDB: Max 1,000/day
- VirusTotal: Max 4/min, 500/day
- OTX: Generally unlimited
- **Solution**: Use a paid tier or wait for limit reset

### Timeout Errors

- Check internet connection
- Verify API endpoint availability (curl test)
- Try again in a moment

### Email Not Sending

- Ensure SMTP vars are set in .env.local
- For Gmail: Use App Password, not main password
- Check SMTP port (usually 587 for TLS)
- Verify firewall allows outbound port

---

## 📚 Documentation

The following were consolidated into this README:
- ✅ THREAT_INTELLIGENCE_SETUP.md
- ✅ THREAT_INTELLIGENCE_ARCHITECTURE.md
- ✅ THREAT_INTELLIGENCE_IMPLEMENTATION.md  
- ✅ THREAT_INTELLIGENCE_QUICKSTART.md
- ✅ PROJECT_COMPLETION_REPORT.md
- ✅ DELIVERY_SUMMARY.md

### API References

- [VirusTotal API v3](https://docs.virustotal.com/reference/overview)
- [AbuseIPDB API v2](https://docs.abuseipdb.com/api-introduction)
- [OTX Alienvault API](https://otx.alienvault.com/api)
- [ipinfo.io API](https://ipinfo.io/docs)

---

## 🚧 Roadmap

### Planned Features

- [ ] SOC Radar integration
- [ ] IBM X-Force integration
- [ ] MXtoolbox integration
- [ ] Cisco Talos integration
- [ ] Result caching (reduce API calls)
- [ ] Historical tracking (save previous checks)
- [ ] Export to CSV/JSON
- [ ] Custom alerts
- [ ] Parallel API calls (rate limit aware)
- [ ] WebSocket real-time updates
- [ ] SOAR platform integration

### Known Limitations

- Sequential processing (not parallel)
- Free tier API rate limits apply
- Bulk mode max 100 indicators
- No persistent result storage
- Dashboard under development

---

## 💬 Support

### Issues?

- Check `.env.local` configuration
- Review logs in `logs/` directory
- Try the troubleshooting section above
- Restart dev server after env changes

### API Support

- **AbuseIPDB**: https://www.abuseipdb.com/contact
- **VirusTotal**: https://support.virustotal.com
- **OTX**: https://github.com/AlienVault-Labs/OTX-Python-SDK
- **ipinfo.io**: https://ipinfo.io/support

---

## 📄 License

[Add your license here]

---

## 👥 Contributors

Built with ❤️ for cybersecurity teams

---

**Last Updated**: March 2026  
**Status**: ✅ Production Ready  
**Version**: 1.0  

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
