# Threat Intelligence Checker Setup Guide

This guide will help you set up the threat intelligence checker with AbuseIPDB, VirusTotal, and OTX (Alienvault) APIs.

## Prerequisites

- Node.js 16+ installed
- API keys from the three threat intelligence sources

## Getting API Keys

### 1. AbuseIPDB

1. Visit https://www.abuseipdb.com/
2. Sign up for a free account or log in
3. Navigate to your API page: https://www.abuseipdb.com/api
4. Generate a new API key
5. Copy the API key

**Features:**
- Free tier: 1,000 requests/day
- Supports IPv4 addresses
- Provides abuse confidence score and report details

### 2. VirusTotal

1. Visit https://www.virustotal.com/
2. Sign up for a free account or log in
3. Navigate to your API key page: https://www.virustotal.com/gui/my-apikey
4. Copy your API key

**Features:**
- Free tier: 4 requests/minute, 500 requests/day
- Supports: IP addresses, domains, URLs, file hashes
- Provides detection ratio from 70+ antivirus engines

### 3. OTX (Alienvault)

1. Visit https://otx.alienvault.com/
2. Sign up for a free account or log in
3. Navigate to your settings: https://otx.alienvault.com/settings
4. Copy your OTX API key

**Features:**
- Free tier: Unlimited requests
- Supports: IPv4, IPv6, domains, hostnames, URLs, file hashes
- Provides threat intelligence pulses and reputation data

## Configuration

### 1. Create `.env.local` File

Create a `.env.local` file in the root directory of the project:

```bash
# Threat Intelligence API Keys
VIRUSTOTAL_API_KEY=your_virustotal_api_key_here
ABUSEIPDB_API_KEY=your_abuseipdb_api_key_here
OTX_API_KEY=your_otx_api_key_here
```

or copy the existing template:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and replace the placeholder values with your actual API keys.

## Usage

### Starting the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Using the Threat Intelligence Checker

1. Navigate to `/intelligence` route
2. Select your preferred threat intelligence source:
   - **AbuseIPDB** (IPv4 addresses) - Default
   - **VirusTotal** (IPs, domains, URLs, file hashes)
   - **OTX Alienvault** (IPs, domains, URLs, file hashes)
3. Enter indicators in the textarea (one per line)
4. The mode will auto-detect based on input:
   - **Single Mode**: 1 indicator
   - **Bulk Mode**: 2-100 indicators
   - **Combined Analysis**: Up to 10 indicators with correlation
5. Click "Check Indicator" to submit
6. View results in the table

### Result Status

- **Malicious** (Red): Confirmed malicious indicator
- **Suspicious** (Yellow): Potentially malicious indicator
- **Clean** (Green): No threats detected
- **Not Found** (Gray): No data available from the source
- **Error** (Red Error Badge): API error or unsupported indicator type

## Supported Indicator Types by Source

### AbuseIPDB
- IPv4 addresses (e.g., `192.168.1.1`)

### VirusTotal
- IPv4 addresses (e.g., `192.168.1.1`)
- IPv6 addresses
- Domains (e.g., `example.com`)
- URLs (e.g., `https://example.com/path`)
- File hashes: MD5, SHA-1, SHA-256

### OTX Alienvault
- IPv4 addresses
- IPv6 addresses
- Domains
- Hostnames
- URLs
- File hashes: MD5, SHA-1, SHA-256

## Response Format

Results are displayed in a tabular format with the following columns:

| Column | Description |
|--------|-------------|
| **Indicator** | The queried indicator (IP, domain, hash, etc.) |
| **Status** | Malicious, Suspicious, Clean, Not Found, or Error |
| **Details** | Source-specific information |
| **Action** | Additional actions (View details button) |

### Example Details by Source

**AbuseIPDB:**
- Risk Score (0-100%)
- Number of abuse reports
- Distinct users reporting abuse
- Country code
- ISP information

**VirusTotal:**
- Detection ratio (malicious+suspicious / total)
- Individual detection counts
- Last analysis date
- Reputation score
- Detected tags

**OTX Alienvault:**
- Pulse count
- Whitelist status
- Reputation score
- Related pulses with malware families
- Attack IDs

## Rate Limiting

Each API has different rate limits:

- **AbuseIPDB**: 1,000 requests/day (free tier)
- **VirusTotal**: 4 requests/minute, 500/day (free tier)
- **OTX**: Unlimited (generally available)

Plan your bulk checks accordingly to stay within limits.

## Troubleshooting

### "API Key not configured"
- Ensure `.env.local` file exists in the project root
- Verify API keys are correctly entered
- Restart the development server after updating `.env.local`

### "Not Found" status
- Indicator may not exist in the source's database
- Indicator type may not be supported by the selected source
- Try a different source that supports your indicator type

### Rate limit exceeded
- Wait before making new requests
- Consider using a paid tier for higher limits
- Spread bulk checks over multiple API calls

### Timeout errors
- Check your internet connection
- Verify API endpoint availability
- Try the API directly on its website

## Security Notes

- Never commit `.env.local` to version control
- Keep API keys confidential
- Don't share API keys in code, logs, or documentation
- Consider rotating API keys periodically
- Use environment variables for sensitive data only

## API Documentation

- [VirusTotal API v3](https://docs.virustotal.com/reference/overview)
- [AbuseIPDB API](https://docs.abuseipdb.com/)
- [OTX Alienvault API](https://otx.alienvault.com/api)

## Future Enhancements

Planned sources to support:
- SOC Radar
- IBM X-Force
- MXtoolbox
- Cisco Talos

## Support

For issues with:
- **AbuseIPDB API**: https://www.abuseipdb.com/contact
- **VirusTotal API**: https://www.virustotal.com/gui/contact-us/
- **OTX API**: https://github.com/AlienVault-Labs/OTX-Python-SDK
