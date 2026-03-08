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
            result = formatAbuseIPDBResult(await checkAbuseIPDB(trimmed))
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

    const statusBadge = (r: (typeof results)[0]) => {
      if (r.error) return <span class="badge badge-error badge-sm">Error</span>
      if (!r.result) return <span class="badge badge-outline badge-sm">Not Found</span>
      const color =
        r.result.status === 'malicious'
          ? 'badge-error'
          : r.result.status === 'suspicious'
            ? 'badge-warning'
            : 'badge-success'
      return <span class={`badge badge-sm ${color}`}>{r.result.status ?? 'Unknown'}</span>
    }

    const summaryCell = (r: (typeof results)[0]) => {
      if (r.error) return <span class="text-error text-xs">{r.error}</span>
      if (!r.result) return null
      return (
        <div class="space-y-1 text-xs">
          {source === 'AbuseIPDB' && r.result.risk_score !== undefined && (
            <p>
              Risk Score: <span class="font-semibold">{r.result.risk_score}%</span>
            </p>
          )}
          {source === 'VirusTotal' && r.result.malicious !== undefined && (
            <p>
              Detections:{' '}
              <span class="font-semibold">
                {r.result.malicious + r.result.suspicious}/
                {r.result.malicious + r.result.suspicious + r.result.undetected + r.result.harmless}
              </span>
            </p>
          )}
          {source === 'OTX Alienvault' && r.result.pulse_count !== undefined && (
            <p>
              Pulses: <span class="font-semibold">{r.result.pulse_count}</span>
            </p>
          )}
          {r.result.reputation !== undefined && (
            <p>
              Reputation: <span class="font-semibold">{r.result.reputation}</span>
            </p>
          )}
        </div>
      )
    }

    return c.html(
      <div class="space-y-4">
        <p class="text-sm text-base-content/60">
          Mode: <span class="font-semibold">{mode}</span> | Source:{' '}
          <span class="font-semibold">{source}</span> | Total:{' '}
          <span class="font-semibold">{indicators.length}</span>
        </p>

        <div class="overflow-x-auto">
          <table class="table table-sm table-zebra w-full">
            <thead>
              <tr class="border-base-300">
                <th>Indicator</th>
                <th>Status</th>
                <th>Summary</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, idx) => (
                <tr key={idx} class="hover:bg-base-200/50 transition-colors">
                  <td
                    class="font-mono text-xs truncate max-w-xs"
                    title={r.indicator}
                  >
                    {r.indicator}
                  </td>
                  <td>{statusBadge(r)}</td>
                  <td>{summaryCell(r)}</td>
                  <td>
                    <button
                      class="btn btn-ghost btn-xs detailsBtn"
                      data-idx={String(idx)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-sm btn-outline" id="newCheckBtn">
            New Check
          </button>
          <button class="btn btn-sm btn-outline" id="copyJsonBtn">
            Copy JSON
          </button>
        </div>

        {/* Hidden payload for copy-JSON */}
        <div
          id="resultsData"
          style="display:none"
          data-results={JSON.stringify({ mode, source, results }).replace(/"/g, '&quot;')}
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

          <form id="checkForm" onsubmit="handleFormSubmit(event)">
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

            {/* INDICATORS INPUT */}
            <textarea
              name="indicators"
              id="indicatorsInput"
              placeholder={`Enter indicators (one per line):\n- Single line → Single Mode\n- Multiple lines → Bulk Mode`}
              class="textarea textarea-bordered h-36 focus:textarea-primary w-full resize-none mb-5"
              onchange="updateModeFromInput()"
              onkeyup="updateModeFromInput()"
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

  async function handleFormSubmit(event) {
    event.preventDefault();
    var resultsArea = document.getElementById('resultsArea');
    resultsArea.innerHTML = '<div class="flex justify-center py-6"><span class="loading loading-spinner loading-lg"></span></div>';

    try {
      var response = await fetch('/intelligence/api/check', { method: 'POST', body: new FormData(event.target) });
      var html = await response.text();
      resultsArea.innerHTML = html;

      resultsArea.querySelectorAll('.detailsBtn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          alert('Details for result #' + (parseInt(this.getAttribute('data-idx')) + 1) + ' - Full details view coming soon!');
        });
      });

      var newCheckBtn = resultsArea.querySelector('#newCheckBtn');
      if (newCheckBtn) {
        newCheckBtn.addEventListener('click', function () {
          resultsArea.innerHTML = '<div class="alert alert-info alert-soft"><span>Ready for new check</span></div>';
          var inp = document.getElementById('indicatorsInput');
          inp.value = '';
          inp.focus();
        });
      }

      var copyJsonBtn = resultsArea.querySelector('#copyJsonBtn');
      if (copyJsonBtn) {
        copyJsonBtn.addEventListener('click', function () {
          var el = resultsArea.querySelector('#resultsData');
          if (el) {
            try { navigator.clipboard.writeText(JSON.stringify(JSON.parse(el.getAttribute('data-results')), null, 2)); }
            catch (e) { console.error('Copy failed', e); }
          }
        });
      }
    } catch (err) {
      resultsArea.innerHTML = '<div class="alert alert-error alert-soft"><span>Error: ' + err.message + '</span></div>';
    }
  }

  document.getElementById('checkForm').addEventListener('submit', handleFormSubmit);
})();
          `,
        }}
      />
    </div>,
  )
})

export default intelligence

