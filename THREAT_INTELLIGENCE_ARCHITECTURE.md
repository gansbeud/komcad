# Threat Intelligence Checker Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Browser)                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │  intelligence.tsx GET /                            │  │
│  │  - Mode Selector (Single/Bulk/Combined)            │  │
│  │  - Source Selector (Radio buttons)                 │  │
│  │  - Indicators Textarea                             │  │
│  │  - Results Table (dynamic render)                  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────────────────────┘
               │ POST /intelligence/api/check
               │ Form data: indicators, source, mode
               ▼
┌─────────────────────────────────────────────────────────┐
│            Backend (Hono Server)                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │  intelligence.post('/api/check')                   │  │
│  │  - Parse form data                                 │  │
│  │  - Validate source and indicators                  │  │
│  │  - Call appropriate API handler                    │  │
│  └────────────────────────────────────────────────────┘  │
│         │           │           │                        │
│         ▼           ▼           ▼                        │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│   │ AbuseIPDB│ │VirusTotal│ │   OTX    │              │
│   │ Handler  │ │ Handler  │ │ Handler  │              │
│   └──────────┘ └──────────┘ └──────────┘              │
│   (abuseipdb.ts) (virustotal.ts) (otx.ts)             │
└──────────────┬───────────────────────────────────────────┘
               │ API Calls (fetch)
               ▼
┌─────────────────────────────────────────────────────────┐
│         Third-Party Threat Intelligence APIs             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  AbuseIPDB   │  │  VirusTotal  │  │  OTX/AV      │  │
│  │   API v2     │  │   API v3     │  │  API v1      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Component Structure

### Frontend Layer (intelligence.tsx)

**GET /${c):**
- Renders the HTML interface with form and results area
- Responsive layout using daisyUI components
- Client-side JavaScript for form handling and mode auto-detection

**POST /api/check:**
- Receives form data with indicators, source, and mode
- Validates input and source
- Calls appropriate API handler based on selected source
- Renders results as HTML table with AJAX-friendly format
- Returns formatted HTML for in-page rendering

### API Handler Layer

#### lib/abuseipdb.ts
```typescript
checkAbuseIPDB(indicator: string)
├─ Validates IPv4 format
├─ Calls https://api.abuseipdb.com/api/v2/check
├─ Returns: AbuseIPDBResult
└─ formatAbuseIPDBResult()
   └─ Returns: { risk_score, status, reports, ... }
```

#### lib/virustotal.ts
```typescript
checkVirusTotal(indicator: string)
├─ Auto-detects indicator type (IP/domain/hash/URL)
├─ Routes to appropriate endpoint:
│  ├─ /ip_addresses/{ip}
│  ├─ /domains/{domain}
│  ├─ /files/{hash}
│  └─ /urls/{url_id}
├─ Returns: VirusTotalResult
└─ formatVirusTotalResult()
   └─ Returns: { status, malicious, suspicious, ... }
```

#### lib/otx.ts
```typescript
checkOTX(indicator: string)
├─ Auto-detects indicator type
├─ Routes to appropriate endpoint:
│  ├─ /api/v1/indicators/IPv4/{ip}/general
│  ├─ /api/v1/indicators/IPv6/{ip}/general
│  ├─ /api/v1/indicators/domain/{domain}/general
│  ├─ /api/v1/indicators/file/{hash}/general
│  └─ /api/v1/indicators/url/{url}/general
├─ Returns: OTXIndicatorResult
└─ formatOTXResult()
   └─ Returns: { status, pulse_count, reputation, ... }
```

## Data Flow

### 1. User Input
```
User enters indicators → Auto-detect mode → Select source → Submit form
```

### 2. Form Submission
```javascript
Form data:
{
  indicators: string (newline-separated),
  source: "AbuseIPDB" | "VirusTotal" | "OTX Alienvault",
  mode: "Single Mode" | "Bulk Mode" | "Combined Analysis"
}
```

### 3. Backend Processing
```
For each indicator:
  1. Trim whitespace
  2. Validate format
  3. Call appropriate API handler
  4. Format result
  5. Handle errors gracefully
```

### 4. Response Format
```
HTML table with columns:
- Indicator
- Status (badge: error/warning/success)
- Details (source-specific info)
- Action buttons (view details)
```

## API Authentication

Each API uses different authentication methods:

### AbuseIPDB
- **Header**: `Key: {API_KEY}`
- **Method**: POST
- **Rate Limit**: 1,000 requests/day (free)

### VirusTotal
- **Header**: `x-apikey: {API_KEY}`
- **Method**: GET
- **Rate Limit**: 4 req/min, 500/day (free)

### OTX
- **Header**: `X-OTX-API-KEY: {API_KEY}`
- **Method**: GET
- **Rate Limit**: Unlimited (free)

## Indicator Type Support Matrix

| Indicator Type | AbuseIPDB | VirusTotal | OTX |
|---|:---:|:---:|:---:|
| IPv4 | ✅ | ✅ | ✅ |
| IPv6 | ❌ | ✅ | ✅ |
| Domain | ❌ | ✅ | ✅ |
| Hostname | ❌ | ✅ | ✅ |
| URL | ❌ | ✅ | ✅ |
| File Hash (MD5) | ❌ | ✅ | ✅ |
| File Hash (SHA-1) | ❌ | ✅ | ✅ |
| File Hash (SHA-256) | ❌ | ✅ | ✅ |

## Error Handling

### Source Level
- Returns `null` if indicator type not supported
- Returns `null` if API call fails
- Graceful fallback with error message

### Endpoint Level
- Validates all inputs before API call
- Catches and logs errors
- Returns user-friendly error messages
- Displays errors in results table

### User Level
- "Not Found" badge for null results
- "Error" badge for failed requests
- Detailed error message in Details column
- Doesn't block other indicators in bulk mode

## Performance Considerations

### Sequential Processing
- Indicators are processed sequentially (one at a time)
- Prevents rate limiting issues
- Keeps API costs predictable
- Single indicator can fail without affecting others

### Caching (Future)
- Could implement result caching
- Cache key: `{source}:{indicator}`
- TTL: Source-dependent (24h for most)

### Bulk Mode Optimization
- Processes up to 100 indicators
- Each call respects API rate limits
- Consider batching API calls in future

## Security

### API Key Protection
- Environment variables (.env.local)
- Never logged or exposed to frontend
- Only used server-side

### Input Validation
- Indicators are trimmed and validated before API calls
- Regex patterns prevent malformed requests
- Size limits on bulk mode (100 indicators max)

### No Data Storage
- Results are not stored
- No database persistence
- Stateless design for scalability

## Configuration

### Environment Variables (.env.local)
```
VIRUSTOTAL_API_KEY=...
ABUSEIPDB_API_KEY=...
OTX_API_KEY=...
```

### Runtime Configuration
- Source selection: User-driven
- Mode selection: Auto-detected from input
- Results format: HTML table (can be extended to JSON)

## Future Enhancements

1. **Additional Sources**
   - SOC Radar
   - IBM X-Force
   - MXtoolbox
   - Cisco Talos

2. **Advanced Features**
   - Result caching
   - Batch API optimization
   - Historical tracking
   - Custom rules/alerts
   - Export to CSV/JSON

3. **UI Improvements**
   - Real-time mode detection UI update
   - Progress bar for bulk checks
   - Detailed result modals
   - Favorites/bookmarks

4. **Performance**
   - Parallel API calls (with rate limit respect)
   - Result streaming for bulk operations
   - WebSocket for real-time updates

## Testing

### Manual Test Cases

**Test 1: Single IP (AbuseIPDB)**
```
Input: 192.168.1.105
Source: AbuseIPDB
Expected: Shows risk score and report count
```

**Test 2: Domain (VirusTotal)**
```
Input: google.com
Source: VirusTotal
Expected: Shows detection ratio and reputation
```

**Test 3: File Hash (OTX)**
```
Input: 356a192b7913b04c54574d18c28d46e6395428ab (SHA-1)
Source: OTX Alienvault
Expected: Shows pulse count and reputation
```

**Test 4: Bulk Mode**
```
Input: 10 different indicators
Source: Any
Expected: All processed, mixed results
Mode: Should auto-detect as "Bulk Mode"
```

**Test 5: Error Handling**
```
Input: Invalid format (random string)
Source: Any
Expected: "Not Found" badge, no crash
```
