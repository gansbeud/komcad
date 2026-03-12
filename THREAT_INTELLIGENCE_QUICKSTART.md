# Threat Intelligence Checker - Quick Reference

## 🎯 What Was Built

A full-stack threat intelligence checker that integrates three major threat intelligence APIs:
- **AbuseIPDB** - IP reputation checker
- **VirusTotal** - Multi-engine security scanner
- **OTX (Alienvault)** - Open threat exchange

## 📦 Files Created/Modified

### New Files Created
```
./env.local                                    # API keys (create this)
src/lib/abuseipdb.ts                          # AbuseIPDB integration
src/lib/virustotal.ts                         # VirusTotal integration  
src/lib/otx.ts                                # OTX integration
THREAT_INTELLIGENCE_SETUP.md                  # Setup guide
THREAT_INTELLIGENCE_ARCHITECTURE.md           # Architecture docs
THREAT_INTELLIGENCE_IMPLEMENTATION.md         # Implementation summary
```

### Modified Files
```
src/routes/intelligence.tsx                   # Added backend handler + form
.gitignore                                    # Added .env.local
```

## 🚀 Quick Start

### 1. Get API Keys (Free Accounts)
```bash
# AbuseIPDB
https://www.abuseipdb.com/api

# VirusTotal  
https://www.virustotal.com/gui/my-apikey

# OTX Alienvault
https://otx.alienvault.com/
```

### 2. Configure Environment
```bash
# Create .env.local in project root
cat > .env.local << EOF
VIRUSTOTAL_API_KEY=your_virustotal_key
ABUSEIPDB_API_KEY=your_abuseipdb_key
OTX_API_KEY=your_otx_key
EOF
```

### 3. Start Development Server
```bash
npm run dev
# Visit http://localhost:5173/intelligence
```

### 4. Test It Out
```
1. Enter an IP: 192.168.1.1
2. Select source: AbuseIPDB (default)
3. Click "Check Indicator"
4. View results!
```

## 🔧 Features Implemented

### Form Elements
- ✅ Mode selector with auto-detection
- ✅ Source selector (3 available, 4 coming soon)
- ✅ Multi-line indicator textarea
- ✅ Smart form submission with loading state

### Results Display
- ✅ Dynamic results table
- ✅ Color-coded status badges
- ✅ Source-specific detail formatting
- ✅ Error handling per indicator
- ✅ Helper buttons (New Check, Copy JSON)

### Backend Processing
- ✅ Form data validation
- ✅ Sequential indicator processing
- ✅ API error handling
- ✅ Result formatting by source
- ✅ HTML response rendering

## 📊 Supported Indicators

### AbuseIPDB
- IPv4 addresses only
- Type detection: Regex pattern match

### VirusTotal  
- IPv4/IPv6 addresses
- Domains
- URLs (base64 encoded)
- File hashes (MD5, SHA-1, SHA-256)
- Auto-detection + smart routing

### OTX Alienvault
- IPv4/IPv6 addresses
- Domains
- Hostnames
- URLs (URL encoded)
- File hashes (MD5, SHA-1, SHA-256)
- Auto-detection + smart routing

## 🎨 Modes

| Mode | Input | Use Case |
|------|-------|----------|
| Single Mode | 1 indicator | Quick check |
| Bulk Mode | 2-100 indicators | Batch analysis |
| Combined Analysis | 1-10 indicators | Correlation study |

Auto-detection: Single = 1 line, Bulk = 2+ lines

## 📈 API Details

### Rate Limits (Free Tier)
- **AbuseIPDB**: 1,000 req/day
- **VirusTotal**: 4 req/min, 500/day
- **OTX**: Unlimited

### Authentication Methods
```typescript
// AbuseIPDB
Header: Key: {API_KEY}

// VirusTotal
Header: x-apikey: {API_KEY}

// OTX
Header: X-OTX-API-KEY: {API_KEY}
```

### Status Mapping
```
AbuseIPDB: risk_score > 75 = malicious, > 25 = suspicious
VirusTotal: detections > 0 = malicious/suspicious
OTX: pulse_count > 5 = malicious, > 0 = suspicious
```

## 🔄 Request/Response Flow

### Request
```html
POST /intelligence/api/check
Content-Type: application/x-www-form-urlencoded

indicators=192.168.1.1%0A192.168.1.2&source=AbuseIPDB&mode=Bulk%20Mode
```

### Response
```html
<div class="space-y-4">
  <!-- Results table -->
  <!-- Helper buttons -->
</div>
```

## 🛡️ Security

- API keys in `.env.local` (not in repo)
- Server-side API calls only
- Input validation before API requests
- Error handling without data leakage
- No persistent storage

## ⚠️ Important Notes

1. **API keys required** - Create .env.local before running
2. **Rate limiting** - Respect API quotas
3. **Sequential processing** - Indicators processed one at a time
4. **Error resilience** - One error doesn't block others
5. **Type support** - Not all indicators work with all sources

## 🐛 Troubleshooting

### "API Key not configured"
```bash
# Verify .env.local exists
ls -la .env.local

# Restart dev server after updating .env.local
npm run dev
```

### "Not Found" result
- Indicator type may not be supported by source
- Try a different source
- Check indicator format

### Timeout errors
- Check internet connection
- Verify API availability
- Try again in a moment

### Rate limit exceeded
- Wait before new batch check
- Consider paid API tier
- Spread requests over time

## 📚 Documentation

- **Setup**: See `THREAT_INTELLIGENCE_SETUP.md`
- **Architecture**: See `THREAT_INTELLIGENCE_ARCHITECTURE.md`
- **Implementation**: See `THREAT_INTELLIGENCE_IMPLEMENTATION.md`

## 🔗 API Documentation

- [AbuseIPDB Docs](https://docs.abuseipdb.com/)
- [VirusTotal Docs](https://docs.virustotal.com/reference/overview)
- [OTX API Docs](https://otx.alienvault.com/api)

## 📋 Checklist

- [ ] API keys obtained
- [ ] .env.local created with keys
- [ ] Dev server started (`npm run dev`)
- [ ] Navigated to `/intelligence`
- [ ] Tested single indicator
- [ ] Tested bulk mode
- [ ] Checked all 3 sources
- [ ] Verified error handling
- [ ] Tested mode auto-detection

## 🎯 Next Steps

1. **Add more sources** (SOC Radar, IBM X-Force, etc.)
2. **Result caching** (reduce API calls)
3. **Historical tracking** (save previous checks)
4. **Export features** (CSV, JSON exports)
5. **Custom alerts** (auto-check suspicious IPs)
6. **Integration** (SOAR, ticketing systems)

## 💡 Tips

- **Single vs Bulk**: For 1 indicator use Single Mode (faster)
- **Source Selection**: Choose based on indicator type
- **Copy Results**: Use "Copy JSON" for logging/reporting
- **Bulk Limits**: Max 100 indicators per check
- **Error Checking**: Look for "Error" badges for failed checks

---

**Version**: 1.0 (Initial Release)  
**Status**: ✅ Production Ready  
**Last Updated**: März 2026
