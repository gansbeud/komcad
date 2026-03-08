# Komcad — Cyber Intelligence Dashboard

A server-side rendered security operations dashboard built with **Hono**, **Tailwind CSS v4**, and **daisyUI 5**, deployed to **Cloudflare Pages**.

---

## Features

| Area | What's included |
|------|----------------|
| **Dashboard** | Live-style threat feed, vulnerability overview, security-systems status, active intelligence feeds, monitored malicious domains |
| **Threat Intelligence Checker** | Query AbuseIPDB, VirusTotal, and OTX AlienVault for IPs, domains, URLs, and file hashes |
| **Multi-source support** | Single, Bulk (up to 100 indicators), and Combined Analysis modes |
| **Themeable UI** | 35+ daisyUI themes selectable at runtime; custom `deepcloud` dark theme included |
| **SPA navigation** | htmx partial page swaps — sidebar always mounted, no full reloads |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Pages (edge, `nodejs_compat`) |
| Framework | [Hono](https://hono.dev) (JSX renderer, routing) |
| CSS | Tailwind CSS v4 + daisyUI 5 |
| Build | Vite 6 + `@hono/vite-build` |
| Nav | htmx 2.x (partial swap) |

---

## Project Structure

```
src/
├── index.tsx               # App entrypoint — Dashboard page + route mounting
├── renderer.tsx            # Shared JSX layout (navbar, sidebar, theme switcher)
├── style.css               # Tailwind + daisyUI config + custom deepcloud theme
├── lib/
│   ├── abuseipdb.ts        # AbuseIPDB v2 API client + formatter
│   ├── virustotal.ts       # VirusTotal v3 API client + formatter
│   └── otx.ts              # OTX AlienVault API client + formatter
└── routes/
    ├── api.ts              # JSON REST endpoint  POST /api/check
    └── intelligence.tsx    # HTML endpoint  GET /intelligence  +  POST /intelligence/api/check
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure API keys

Create `.env.local` in the project root:

```env
ABUSEIPDB_API_KEY=your_key_here
VIRUSTOTAL_API_KEY=your_key_here
OTX_API_KEY=your_key_here
```

Keys are loaded by `vite.config.ts` via `dotenv` during development.  
For production, set them as [Cloudflare Pages secrets](https://developers.cloudflare.com/pages/platform/environment-variables/).

### 3. Start dev server

```bash
npm run dev
```

Open <http://localhost:5173>.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview production build via Wrangler |
| `npm run deploy` | Build + deploy to Cloudflare Pages |
| `npm run cf-typegen` | Regenerate Cloudflare bindings types |

---

## API Reference

### `POST /api/check`  _(JSON)_

Check one or more indicators against a single source.

**Request body**

```json
{
  "indicators": ["8.8.8.8", "malicious.ru"],
  "source": "VirusTotal",
  "mode": "Bulk Mode"
}
```

**Response**

```json
{
  "mode": "Bulk Mode",
  "source": "VirusTotal",
  "total_indicators": 2,
  "results": [
    {
      "indicator": "8.8.8.8",
      "source": "VirusTotal",
      "result": { "status": "clean", "malicious": 0, "..." : "..." }
    }
  ]
}
```

`source` must be one of: `AbuseIPDB`, `VirusTotal`, `OTX Alienvault`.  
Empty lines in `indicators` are silently skipped; `total_indicators` reflects the actual processed count.

---

## Indicator Type Detection

Each library auto-detects the indicator type:

| Pattern | Detected as |
|---------|-------------|
| `x.x.x.x` (each octet 0–255) | IPv4 |
| `x:x::x` (2–8 colon-separated hex groups) | IPv6 |
| 32 / 40 / 64 hex chars | File hash (MD5 / SHA-1 / SHA-256) |
| `https?://…` | URL |
| `domain.tld` | Domain |

**AbuseIPDB** only accepts IPv4; other types return `null`.

---

## Supported Sources

| Source | Status | Supported types |
|--------|--------|-----------------|
| AbuseIPDB | ✅ Live | IPv4 |
| VirusTotal | ✅ Live | IPv4, domain, URL, hash |
| OTX AlienVault | ✅ Live | IPv4, IPv6, domain, URL, hash |
| SOC Radar | 🔜 Planned | — |
| IBM X-Force | 🔜 Planned | — |
| MXtoolbox | 🔜 Planned | — |
| Cisco Talos | 🔜 Planned | — |

---

## Theming

The UI ships a custom `deepcloud` dark theme (see `src/style.css`).  
The theme picker in the navbar lets users switch between all 35+ built-in daisyUI themes at runtime using `theme-controller` radio inputs.  
The `synthwave` theme is the preferred-dark fallback.

---

## Deployment

```bash
npm run deploy
```

This runs `vite build` then `wrangler pages deploy ./dist`.  
Ensure `ABUSEIPDB_API_KEY`, `VIRUSTOTAL_API_KEY`, and `OTX_API_KEY` are set as encrypted environment variables in your Cloudflare Pages project settings.

### Cloudflare bindings

To add KV, R2, D1, or AI bindings, uncomment the relevant sections in `wrangler.jsonc` then regenerate types:

```bash
npm run cf-typegen
```

Pass the generated bindings to Hono:

```ts
// src/index.tsx
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

---

## Changelog (v4)

> Branch `v4` — corrections applied after full codebase audit.

### Bug fixes

- **`intelligence.tsx`** — removed `onkeyup`/`onchange` inline attributes that referenced `updateModeFromInput` scoped inside an IIFE; they threw `ReferenceError` on every keystroke. The `addEventListener('input', …)` in the inline script is now the sole handler.
- **`intelligence.tsx`** — replaced `data-results` HTML attribute (missing `&`/`<`/`>` escaping) with a `<script type="application/json">` element; eliminates encoding corruption for indicator values that contain HTML special characters.
- **`api.ts`** — wrapped all `switch` cases in blocks, fixing a `no-case-declarations` issue where `const` declarations in unscoped case clauses could cause lint errors and unexpected hoisting behaviour.
- **`api.ts`** — `total_indicators` previously returned the raw input-array length including blank lines; now returns the count of actually processed (non-empty) indicators.
- **`index.tsx`** — trend badge colour was `badge-error` for every up-trend regardless of context. Added a `goodTrend` flag per stat so "Blocked Attacks ↗" and "Network Uptime ↗" correctly render as `badge-success`.

### Robustness improvements

- **`abuseipdb.ts`** — IPv4 regex now validates each octet to 0–255 (was `\d{1,3}` which accepted `999.999.999.999`).
- **`otx.ts`** — IPv6 regex tightened to require at least two colon-separated hex groups, rejecting false positives like `beef:`.
- **`renderer.tsx`** — disabled sidebar `<a>` links now carry `tabindex="-1"` and `aria-disabled="true"` so keyboard users cannot tab into placeholder navigation items.

---

## License

MIT
