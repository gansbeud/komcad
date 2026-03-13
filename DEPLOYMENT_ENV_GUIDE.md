# Environment Variables Configuration Guide

## Problem Summary

Your deployed Cloudflare worker could read username/password but **not API keys**. This happened because:

- ✅ **auth.tsx** used a dual fallback: `c.env` (Cloudflare) **then** `process.env` (local)
- ❌ **abuseipdb.ts, virustotal.ts, otx.ts** only checked `process.env`, which is empty when deployed

**Why username/password worked**: The `auth.tsx` route had the smart fallback pattern built in.

## What Was Fixed

### 1. Updated API Functions to Accept Environment Parameter
- `src/lib/abuseipdb.ts` ✅
- `src/lib/virustotal.ts` ✅
- `src/lib/otx.ts` ✅
- `src/lib/threatfox.ts` ✅
- `src/lib/mailer.ts` ✅

Each now uses:
```typescript
const apiKey = (env?.API_KEY) ?? (process.env.API_KEY) ?? ''
```

### 2. Updated Routes to Pass Environment
- `src/routes/api.ts` - Added `Bindings: ApiEnv` type ✅
- `src/routes/intelligence.tsx` - Added `Bindings: IntelligenceEnv` type ✅
- All function calls now pass `env` parameter ✅

### 3. Updated wrangler.jsonc
- Added `vars` section for non-sensitive variables ✅
- Added comments with deployment instructions ✅

## Deployment Steps

### Step 1: Set Up Local Development (.env.local already has these)
Your `.env.local` file already contains all values. No changes needed for local development.

### Step 2: Set Secrets in Cloudflare Production

Use `wrangler` CLI to securely set each secret:

```bash
# API Keys
wrangler secret put ABUSEIPDB_API_KEY
wrangler secret put VIRUSTOTAL_API_KEY
wrangler secret put OTX_API_KEY
wrangler secret put THREATFOX_API_KEY
wrangler secret put IPINFO_API_KEY

# Auth
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_USER
wrangler secret put ADMIN_PASS
wrangler secret put DEMO_USER
wrangler secret put DEMO_PASS

# SMTP
wrangler secret put SMTP_HOST
wrangler secret put SMTP_PORT
wrangler secret put SMTP_USER
wrangler secret put SMTP_PASS
wrangler secret put SMTP_FROM
wrangler secret put REPORT_TO
```

Each command will prompt you to enter the value securely (it won't be echoed to terminal).

### Step 3: Verify wrangler.jsonc Configuration

The `vars` section is automatically set for public variables:
```jsonc
"vars": {
  "DEMO_RATE_BULK_MAX": "5",
  "DEMO_RATE_COMBINED_MAX": "2"
}
```

These don't need `wrangler secret put` since they're not sensitive.

### Step 4: Deploy

```bash
wrangler deploy
```

## Testing

After deployment, verify that API keys are accessible:

1. **Login** with admin/demo credentials - This should work (was already working)
2. **Run a check** with AbuseIPDB source - This should now work ✅
3. **Check report email** - This should now work ✅

## How Secrets Work

| Method | Local Dev | Production | Risk |
|--------|-----------|------------|------|
| `.env.local` | ✅ Works | ❌ Ignored | Low - stays local |
| `wrangler secret put` | ❌ Not used | ✅ Works | Safe - encrypted in Cloudflare |
| `process.env` | ✅ Works (dotenv) | ❌ Empty | N/A |
| `c.env` (Cloudflare) | ❌ Ignored | ✅ Works | N/A |

**Fallback Pattern (now implemented everywhere)**:
```
Check c.env (Cloudflare in production) 
  → If not found, check process.env (local development)
  → If still not found, use default or throw error
```

## Why This Design?

1. **Security**: Production secrets never appear in code
2. **Simplicity**: Same code works locally and in production
3. **Flexibility**: Easy to override values per environment
4. **Development**: `.env.local` works without any CLI commands

## References

- [Wrangler Secrets Documentation](https://developers.cloudflare.com/workers/wrangler/secrets/)
- [Cloudflare Pages Environment Variables](https://developers.cloudflare.com/pages/functions/bindings/)
