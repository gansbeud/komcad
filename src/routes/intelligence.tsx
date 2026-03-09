import { Hono } from 'hono'
import { checkAbuseIPDB, formatAbuseIPDBResult } from '../lib/abuseipdb'
import { checkVirusTotal, formatVirusTotalResult } from '../lib/virustotal'
import { checkOTX, formatOTXResult } from '../lib/otx'

const intelligence = new Hono()

// POST /api/check — returns an HTML fragment injected into #resultsArea
intelligence.post('/api/check', async (c) => {
  try {
    const formData = await c.req.formData()
    const indicators = String(formData.get('indicators'))
      .split('\n')
      .map((i) => i.trim())
      .filter((i) => i.length > 0)
    const source = String(formData.get('source') || 'AbuseIPDB')
    const mode = String(formData.get('mode') || 'Single Mode')
    const maxAgeInDays = Math.max(1, Math.min(365, parseInt(String(formData.get('maxAgeInDays') || '180'), 10) || 180))

    if (indicators.length === 0) {
      return c.html(
        <div class="alert alert-warning alert-soft">
          <span>Please enter at least one indicator</span>
        </div>
      )
    }

    const availableSources = ['AbuseIPDB', 'VirusTotal', 'OTX Alienvault']
    if (!availableSources.includes(source)) {
      return c.html(
        <div class="alert alert-error alert-soft">
          <span>Source {source} is not available yet</span>
        </div>
      )
    }

    const results: { indicator: string; source: string; result: any; error?: string }[] = []

    for (const indicator of indicators) {
      const trimmed = indicator.trim()
      if (!trimmed) continue
      try {
        let result: any = null
        switch (source) {
          case 'AbuseIPDB':
            result = formatAbuseIPDBResult(await checkAbuseIPDB(trimmed, maxAgeInDays))
            break
          case 'VirusTotal':
            result = formatVirusTotalResult(await checkVirusTotal(trimmed), trimmed)
            break
          case 'OTX Alienvault':
            result = formatOTXResult(await checkOTX(trimmed), trimmed)
            break
        }
        results.push({ indicator: trimmed, source, result })
      } catch (err) {
        results.push({
          indicator: trimmed,
          source,
          result: null,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    // Jakarta time (WIB = UTC+7)
    const submittedAt =
      new Date().toLocaleString('en-GB', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }) + ' WIB'

    // Audit API URL
    const apiUrl =
      source === 'AbuseIPDB'
        ? `https://api.abuseipdb.com/api/v2/check?maxAgeInDays=${maxAgeInDays}&verbose=1`
        : source === 'VirusTotal'
          ? 'https://www.virustotal.com/api/v3/{type}/{indicator}'
          : 'https://otx.alienvault.com/api/v1/indicators/IPv4/{indicator}/general'

    // Null-safe cell helpers
    const v = (val: any) => (val !== null && val !== undefined ? String(val) : '-')
    const bv = (val: any) => (val === null || val === undefined ? '-' : val ? 'Yes' : 'No')
    const toJakartaTime = (dateStr: string | null | undefined): string => {
      if (!dateStr) return '-'
      try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return String(dateStr)
        return date.toLocaleString('en-GB', {
          timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }) + ' WIB'
      } catch { return String(dateStr) }
    }
    const unixToJakartaTime = (ts: number | null | undefined): string => {
      if (!ts) return '-'
      try {
        return new Date(ts * 1000).toLocaleString('en-GB', {
          timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }) + ' WIB'
      } catch { return '-' }
    }

    const renderAbuseIPDBTable = () => (
      <table class="table table-xs table-zebra w-full" id="resultsTable">
        <thead>
          <tr class="border-base-300">
            <th>IP Address</th>
            <th>Whitelisted</th>
            <th>Tor</th>
            <th>Abuse Score</th>
            <th>Reports</th>
            <th>Country</th>
            <th>Country Name</th>
            <th>ISP</th>
            <th>Domain</th>
            <th>Hostnames</th>
            <th>Usage Type</th>
            <th>Last Reported</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, idx) => {
            if (r.error) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={11} class="text-error text-xs">{r.error}</td>
                </tr>
              )
            }
            if (!r.result) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={11} class="text-base-content/50 text-xs italic">Not found / unsupported indicator type</td>
                </tr>
              )
            }
            const d = r.result
            const abuseScore = d.abuseConfidenceScore ?? 0
            const abuseBadge = abuseScore > 75 ? 'badge-error' : abuseScore > 25 ? 'badge-warning' : 'badge-success'
            return (
              <tr key={idx} class="hover:bg-base-200/50">
                <td class="font-mono text-xs">{v(d.ipAddress)}</td>
                <td class="text-xs">{bv(d.isWhitelisted)}</td>
                <td class="text-xs">{bv(d.isTor)}</td>
                <td><span class={`badge badge-sm ${abuseBadge}`}>{abuseScore}%</span></td>
                <td class="text-xs">{v(d.totalReports)}</td>
                <td class="text-xs">{v(d.countryCode)}</td>
                <td class="text-xs">{v(d.countryName)}</td>
                <td class="text-xs truncate max-w-40" title={v(d.isp)}>{v(d.isp)}</td>
                <td class="text-xs">{v(d.domain)}</td>
                <td class="text-xs truncate max-w-32" title={(d.hostnames ?? []).join(', ')}>
                  {(d.hostnames ?? []).length > 0 ? (d.hostnames as string[]).join(', ') : '-'}
                </td>
                <td class="text-xs">{v(d.usageType)}</td>
                <td class="text-xs whitespace-nowrap">{toJakartaTime(d.lastReportedAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )

    const renderVirusTotalTable = () => (
      <table class="table table-xs table-zebra w-full" id="resultsTable">
        <thead>
          <tr class="border-base-300">
            <th>ID</th>
            <th>Malicious</th>
            <th>Suspicious</th>
            <th>Harmless</th>
            <th>RDAP Name</th>
            <th>Country</th>
            <th>AS Owner</th>
            <th>Votes (+)</th>
            <th>Votes (-)</th>
            <th>Reputation</th>
            <th>Tags</th>
            <th>Crowdsourced Context</th>
            <th>Last Analysis</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, idx) => {
            if (r.error) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={12} class="text-error text-xs">{r.error}</td>
                </tr>
              )
            }
            if (!r.result) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={12} class="text-base-content/50 text-xs italic">Not found / unsupported indicator type</td>
                </tr>
              )
            }
            const d = r.result
            const st = d.last_analysis_stats ?? {}
            const ctxSummary =
              Array.isArray(d.crowdsourced_context) && d.crowdsourced_context.length > 0
                ? d.crowdsourced_context
                    .map((cx: any) => `[${v(cx.severity)}] ${v(cx.title)}: ${v(cx.details)} (${v(cx.source)})`)
                    .join(' | ')
                : '-'
            return (
              <tr key={idx} class="hover:bg-base-200/50">
                <td class="font-mono text-xs">{v(d.id)}</td>
                <td><span class={`badge badge-sm ${ (st.malicious ?? 0) > 0 ? 'badge-error' : 'badge-outline'}`}>{st.malicious ?? 0}</span></td>
                <td><span class={`badge badge-sm ${ (st.suspicious ?? 0) > 0 ? 'badge-warning' : 'badge-outline'}`}>{st.suspicious ?? 0}</span></td>
                <td><span class={`badge badge-sm ${ (st.harmless ?? 0) > 0 ? 'badge-success' : 'badge-outline'}`}>{st.harmless ?? 0}</span></td>
                <td class="text-xs">{v(d.rdap_name)}</td>
                <td class="text-xs">{v(d.country)}</td>
                <td class="text-xs truncate max-w-32" title={v(d.as_owner)}>{v(d.as_owner)}</td>
                <td class="text-xs text-success font-semibold">{d.total_votes ? v(d.total_votes.harmless) : '-'}</td>
                <td class="text-xs text-error font-semibold">{d.total_votes ? v(d.total_votes.malicious) : '-'}</td>
                <td class={`text-xs font-semibold ${ (d.reputation ?? 0) < 0 ? 'text-error' : (d.reputation ?? 0) > 0 ? 'text-success' : 'text-base-content/60'}`}>{v(d.reputation)}</td>
                <td class="text-xs truncate max-w-24" title={Array.isArray(d.tags) ? (d.tags as string[]).join(', ') : '-'}>
                  {Array.isArray(d.tags) && d.tags.length > 0 ? (d.tags as string[]).join(', ') : '-'}
                </td>
                <td class="text-xs truncate max-w-48" title={ctxSummary}>{ctxSummary}</td>
                <td class="text-xs whitespace-nowrap">{unixToJakartaTime(d.last_analysis_date)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )

    const renderOTXTable = () => (
      <table class="table table-xs table-zebra w-full" id="resultsTable">
        <thead>
          <tr class="border-base-300">
            <th>Indicator</th>
            <th>Status</th>
            <th>Whitelisted</th>
            <th>Reputation</th>
            <th>Pulse Count</th>
            <th>Pulse Names</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, idx) => {
            if (r.error) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={5} class="text-error text-xs">{r.error}</td>
                </tr>
              )
            }
            if (!r.result) {
              return (
                <tr key={idx} class="hover:bg-base-200/50">
                  <td class="font-mono text-xs">{r.indicator}</td>
                  <td colSpan={5} class="text-base-content/50 text-xs italic">Not found / unsupported indicator type</td>
                </tr>
              )
            }
            const d = r.result
            const statusColor = d.status === 'malicious' ? 'badge-error' : d.status === 'suspicious' ? 'badge-warning' : 'badge-success'
            const repColor = (d.reputation ?? 0) < 0 ? 'text-error' : (d.reputation ?? 0) > 0 ? 'text-success' : 'text-base-content/60'
            const pulseNamesList = Array.isArray(d.pulses) && d.pulses.length > 0
              ? (d.pulses as Array<{ name: string }>).map(p => p.name).join(' · ')
              : '-'
            return (
              <tr key={idx} class="hover:bg-base-200/50">
                <td class="font-mono text-xs">{v(d.indicator)}</td>
                <td><span class={`badge badge-sm ${statusColor}`}>{v(d.status)}</span></td>
                <td class="text-xs">{bv(d.whitelisted)}</td>
                <td class={`text-xs font-semibold ${repColor}`}>{v(d.reputation)}</td>
                <td class="text-xs">{v(d.pulse_count)}</td>
                <td class="text-xs max-w-72 truncate" title={pulseNamesList}>{pulseNamesList}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )

    return c.html(
      <div class="space-y-4">
        <p class="text-sm text-base-content/60">
          Mode: <span class="font-semibold">{mode}</span> | Source:{' '}
          <span class="font-semibold">{source}</span> | Total:{' '}
          <span class="font-semibold">{results.length}</span>
        </p>

        <div class="overflow-x-auto rounded-lg border border-base-300">
          {source === 'AbuseIPDB'
            ? renderAbuseIPDBTable()
            : source === 'VirusTotal'
              ? renderVirusTotalTable()
              : renderOTXTable()}
        </div>

        {/* Audit Information */}
        <div class="border border-base-300 rounded-lg p-3 bg-base-200/50 text-xs space-y-1 text-base-content/70">
          <p class="font-semibold text-base-content/90 mb-1">Audit Information</p>
          <p>Date Submitted: <span class="font-mono">{submittedAt}</span></p>
          <p>API Endpoint: <span class="font-mono break-all">{apiUrl}</span></p>
        </div>

        {/* Action Buttons */}
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-sm btn-outline" id="newCheckBtn">↩ New Check</button>
          <button class="btn btn-sm btn-outline" id="copyTableBtn">📋 Copy to Clipboard</button>
          <button class="btn btn-sm btn-outline" id="exportCsvBtn">⬇ Export to CSV</button>
          <button class="btn btn-sm btn-outline" id="copyPtmBtn">🔗 Copy PTM Format</button>
        </div>

        {/* Hidden JSON payload for client-side button actions */}
        <script
          id="resultsData"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ mode, source, maxAgeInDays, results }).replace(/<\/script/gi, '<\/script'),
          }}
        />
      </div>
    )
  } catch (error) {
    console.error('Check error:', error)
    return c.html(
      <div class="alert alert-error alert-soft">
        <span>{error instanceof Error ? error.message : 'An unexpected error occurred'}</span>
      </div>
    )
  }
})

// GET / — rendered through the shared jsxRenderer (sidebar + navbar included automatically)
intelligence.get('/', (c) => {
  return c.render(
    <div class="space-y-6">
      {/* PAGE HEADER */}
      <div>
        <h1 class="text-4xl font-bold mb-2">Threat Intelligence Checker</h1>
        <p class="text-base-content/70">
          Analyze indicators across multiple threat intelligence sources
        </p>
      </div>

      {/* STATS ROW */}
      <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: '📊', title: 'Sources', value: '7', color: 'text-primary' },
          { icon: '✓', title: 'Checks Today', value: '44', color: 'text-success' },
          { icon: '⚡', title: 'Avg Speed', value: '1.2s', color: 'text-info' },
          { icon: '🛡️', title: 'Malicious Found', value: '12', color: 'text-warning' },
        ].map((s) => (
          <div key={s.title} class="stat bg-base-100 shadow-md border border-base-300 rounded-lg">
            <div class="stat-figure text-3xl">{s.icon}</div>
            <div class="stat-title text-sm opacity-70">{s.title}</div>
            <div class={`stat-value text-2xl ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* CHECKER CARD */}
      <div class="card bg-base-100 shadow-md border border-base-300">
        <div class="card-body gap-5">
          <h2 class="card-title">🔍 Check Indicators</h2>

          <form id="checkForm">
            {/* MODE SELECTOR */}
            <div class="mb-5">
              <label class="label pb-1">
                <span class="label-text font-semibold">Mode</span>
                <span class="text-xs text-base-content/60">Auto-detected from input</span>
              </label>
              <div class="flex gap-2 flex-wrap">
                {(['Single Mode', 'Bulk Mode', 'Combined Analysis'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    class={`btn btn-sm modeBtn ${m === 'Single Mode' ? 'btn-primary' : 'btn-outline'}`}
                    data-mode={m}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <input type="hidden" name="mode" id="modeInput" value="Single Mode" />
            </div>

            {/* SOURCE SELECTOR */}
            <div class="mb-5">
              <label class="label pb-1">
                <span class="label-text font-semibold">Select Source</span>
              </label>
              <div class="flex flex-wrap gap-3">
                {[
                  { value: 'SOC Radar', disabled: true },
                  { value: 'VirusTotal', disabled: false },
                  { value: 'AbuseIPDB', disabled: false, checked: true },
                  { value: 'IBM X-Force', disabled: true },
                  { value: 'OTX Alienvault', disabled: false },
                  { value: 'MXtoolbox', disabled: true },
                  { value: 'Cisco Talos', disabled: true },
                ].map((s) => (
                  <label
                    key={s.value}
                    class={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${s.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-base-200'}`}
                  >
                    <input
                      type="radio"
                      name="source"
                      value={s.value}
                      disabled={s.disabled}
                      checked={s.checked}
                      class="radio radio-primary radio-sm"
                    />
                    <span class={`text-sm font-medium ${s.disabled ? 'line-through' : ''}`}>
                      {s.value}
                    </span>
                  </label>
                ))}
              </div>
              <p class="text-xs text-base-content/60 mt-1">More sources coming soon</p>
            </div>

            {/* MAX AGE IN DAYS — only visible for AbuseIPDB */}
            <div id="maxAgeContainer" class="mb-5">
              <label class="label pb-1">
                <span class="label-text font-semibold">Max Age In Days</span>
                <span class="text-xs text-base-content/60">AbuseIPDB report history window</span>
              </label>
              <input
                type="number"
                name="maxAgeInDays"
                id="maxAgeInput"
                min="1"
                max="365"
                value="180"
                class="input input-bordered input-sm w-40"
              />
              <p class="text-xs text-base-content/60 mt-1">Range: 1–365 days (default 180)</p>
            </div>

            {/* INDICATORS INPUT */}
            <textarea
              name="indicators"
              id="indicatorsInput"
              placeholder={`Enter indicators (one per line):\n- Single line → Single Mode\n- Multiple lines → Bulk Mode`}
              class="textarea textarea-bordered h-36 focus:textarea-primary w-full resize-none mb-5"
            />

            <button type="submit" class="btn btn-primary w-full">
              Check Indicator
            </button>
          </form>
        </div>
      </div>

      {/* RESULTS CARD */}
      <div class="card bg-base-100 shadow-md border border-base-300">
        <div class="card-body">
          <h2 class="card-title mb-2">Results</h2>
          <div id="resultsArea" class="alert alert-info alert-soft">
            <span>Enter an indicator and select a source to see results here</span>
          </div>
        </div>
      </div>

      {/* MODE INFO CARDS */}
      <div class="grid gap-4 grid-cols-1 md:grid-cols-3">
        {[
          {
            icon: '1️⃣',
            title: 'Single Mode',
            desc: 'Check one indicator quickly',
            label: 'Supports',
            items: [
              'IPv4 & IPv6 addresses',
              'Domains & subdomains',
              'URLs & file paths',
              'File hashes (MD5, SHA-1, SHA-256)',
            ],
          },
          {
            icon: '📋',
            title: 'Bulk Mode',
            desc: 'Check multiple indicators at once',
            label: 'Limits',
            items: [
              'Up to 100 indicators',
              'One per line',
              'Mixed types supported',
              'Results exported to CSV',
            ],
          },
          {
            icon: '🔗',
            title: 'Advanced',
            desc: 'Correlate & analyze together',
            label: 'Features',
            items: [
              'Up to 10 indicators',
              'Correlation analysis',
              'Campaign tracking',
              'Report generation',
            ],
          },
        ].map((card) => (
          <div key={card.title} class="card bg-base-100 shadow-md border border-base-300">
            <div class="card-body">
              <h2 class="card-title text-lg">
                <span class="text-3xl">{card.icon}</span>
                {card.title}
              </h2>
              <p class="text-sm text-base-content/70">{card.desc}</p>
              <p class="text-xs font-semibold mt-2">{card.label}:</p>
              <ul class="text-xs space-y-1 list-disc list-inside opacity-70">
                {card.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* HELP ALERT */}
      <div class="alert alert-info alert-soft">
        <span class="text-xl">ℹ️</span>
        <div>
          <h3 class="font-bold">Need Help?</h3>
          <p class="text-sm">
            Check our documentation for API integration, bulk import guides, and source accuracy
            rates.
          </p>
        </div>
      </div>

      {/* CLIENT-SIDE LOGIC */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function () {
  // ── Mode buttons ────────────────────────────────────────────────────────────
  function setMode(mode) {
    document.getElementById('modeInput').value = mode;
    document.querySelectorAll('.modeBtn').forEach(function (btn) {
      var active = btn.getAttribute('data-mode') === mode;
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-outline', !active);
    });
  }

  function updateModeFromInput() {
    var lines = document.getElementById('indicatorsInput').value.trim().split('\\n').filter(function (l) { return l.trim(); });
    setMode(lines.length <= 1 ? 'Single Mode' : 'Bulk Mode');
  }

  document.querySelectorAll('.modeBtn').forEach(function (btn) {
    btn.addEventListener('click', function () { setMode(this.getAttribute('data-mode')); });
  });

  document.getElementById('indicatorsInput').addEventListener('input', updateModeFromInput);

  // ── MaxAge visibility (only for AbuseIPDB) ──────────────────────────────────
  function updateMaxAgeVisibility() {
    var source = document.querySelector('input[name="source"]:checked');
    var container = document.getElementById('maxAgeContainer');
    if (container) {
      container.style.display = (source && source.value === 'AbuseIPDB') ? '' : 'none';
    }
  }

  document.querySelectorAll('input[name="source"]').forEach(function (radio) {
    radio.addEventListener('change', updateMaxAgeVisibility);
  });
  updateMaxAgeVisibility();

  // ── Form submit ──────────────────────────────────────────────────────────────
  async function handleFormSubmit(event) {
    event.preventDefault();
    var resultsArea = document.getElementById('resultsArea');
    resultsArea.innerHTML = '<div class="flex justify-center py-6"><span class="loading loading-spinner loading-lg"></span></div>';
    try {
      var response = await fetch('/intelligence/api/check', { method: 'POST', body: new FormData(event.target) });
      var html = await response.text();
      resultsArea.innerHTML = html;
      attachResultHandlers();
    } catch (err) {
      resultsArea.innerHTML = '<div class="alert alert-error alert-soft"><span>Error: ' + err.message + '</span></div>';
    }
  }

  document.getElementById('checkForm').addEventListener('submit', handleFormSubmit);

  // ── Post-render button handlers ──────────────────────────────────────────────
  function attachResultHandlers() {
    var resultsArea = document.getElementById('resultsArea');

    var newCheckBtn = resultsArea.querySelector('#newCheckBtn');
    if (newCheckBtn) {
      newCheckBtn.addEventListener('click', function () {
        resultsArea.innerHTML = '<div class="alert alert-info alert-soft"><span>Ready for new check</span></div>';
        var inp = document.getElementById('indicatorsInput');
        inp.value = '';
        inp.focus();
      });
    }

    // Copy table as TSV to clipboard
    var copyTableBtn = resultsArea.querySelector('#copyTableBtn');
    if (copyTableBtn) {
      copyTableBtn.addEventListener('click', function () {
        var table = resultsArea.querySelector('#resultsTable');
        if (!table) return;
        var rows = Array.from(table.querySelectorAll('tr'));
        var tsv = rows.map(function (row) {
          return Array.from(row.querySelectorAll('th,td')).map(function (cell) {
            return (cell.getAttribute('title') || cell.textContent || '').trim();
          }).join('\\t');
        }).join('\\n');
        navigator.clipboard.writeText(tsv).then(function () {
          copyTableBtn.textContent = '\\u2713 Copied!';
          setTimeout(function () { copyTableBtn.textContent = '\\uD83D\\uDCCB Copy to Clipboard'; }, 2000);
        }).catch(function (e) { console.error('Copy failed', e); });
      });
    }

    // Export table as CSV download
    var exportCsvBtn = resultsArea.querySelector('#exportCsvBtn');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', function () {
        var table = resultsArea.querySelector('#resultsTable');
        if (!table) return;
        var rows = Array.from(table.querySelectorAll('tr'));
        var csv = rows.map(function (row) {
          return Array.from(row.querySelectorAll('th,td')).map(function (cell) {
            var text = ((cell.getAttribute('title') || cell.textContent || '').trim()).replace(/"/g, '""');
            return '"' + text + '"';
          }).join(',');
        }).join('\\n');
        var blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'intel_results_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // Copy PTM format: (IP (Hostname,countryCode), ...
    var copyPtmBtn = resultsArea.querySelector('#copyPtmBtn');
    if (copyPtmBtn) {
      copyPtmBtn.addEventListener('click', function () {
        var el = resultsArea.querySelector('#resultsData');
        if (!el) return;
        try {
          var data = JSON.parse(el.textContent || '{}');
          var src = data.source;
          var entries = (data.results || []).map(function (r) {
            if (!r.result) return null;
            var ip = '', hostname = '', cc = '';
            if (src === 'AbuseIPDB') {
              ip = r.result.ipAddress || r.indicator;
              hostname = (r.result.hostnames && r.result.hostnames[0]) || r.result.domain || '-';
              cc = r.result.countryCode || '-';
            } else if (src === 'VirusTotal') {
              ip = r.result.id || r.indicator;
              hostname = r.result.rdap_name || '-';
              cc = r.result.country || '-';
            } else {
              ip = r.indicator; hostname = '-'; cc = '-';
            }
            return '(' + ip + ' (' + hostname + ',' + cc + ')';
          }).filter(Boolean);
          navigator.clipboard.writeText(' ' + entries.join(', ')).then(function () {
            copyPtmBtn.textContent = '\\u2713 Copied PTM!';
            setTimeout(function () { copyPtmBtn.textContent = '\\uD83D\\uDD17 Copy PTM Format'; }, 2000);
          });
        } catch (e) { console.error('PTM copy failed', e); }
      });
    }
  }
})();
          `,
        }}
      />
    </div>,
    // @ts-expect-error — Hono ContextRenderer not extended; title is picked up by renderer.tsx
    { title: 'Threat Intelligence' }
  )
})

export default intelligence

