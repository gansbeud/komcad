import { Hono } from 'hono'
import { checkAbuseIPDB, formatAbuseIPDBResult } from '../lib/abuseipdb'
import { checkVirusTotal, formatVirusTotalResult } from '../lib/virustotal'
import { checkOTX, formatOTXResult } from '../lib/otx'

const intelligence = new Hono()

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

    // Validate source
    const availableSources = ['AbuseIPDB', 'VirusTotal', 'OTX Alienvault']
    if (!availableSources.includes(source)) {
      return c.html(
        <div class="alert alert-error alert-soft">
          <span>Source {source} is not available yet</span>
        </div>
      )
    }

    const results = []

    for (const indicator of indicators) {
      const trimmedIndicator = indicator.trim()
      if (!trimmedIndicator) continue

      try {
        let result = null

        switch (source) {
          case 'AbuseIPDB':
            const abuseResult = await checkAbuseIPDB(trimmedIndicator)
            result = formatAbuseIPDBResult(abuseResult)
            break

          case 'VirusTotal':
            const vtResult = await checkVirusTotal(trimmedIndicator)
            result = formatVirusTotalResult(vtResult, trimmedIndicator)
            break

          case 'OTX Alienvault':
            const otxResult = await checkOTX(trimmedIndicator)
            result = formatOTXResult(otxResult, trimmedIndicator)
            break
        }

        results.push({
          indicator: trimmedIndicator,
          source: source,
          result: result
        })
      } catch (error) {
        results.push({
          indicator: trimmedIndicator,
          source: source,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Build results HTML
    const resultsHTML = results.map((result: any, idx: number) => `
      <tr class="hover:bg-base-200/50 transition-colors">
        <td class="font-mono text-xs truncate max-w-xs" title="${result.indicator}">
          ${result.indicator}
        </td>
        <td>
          ${result.error 
            ? '<span class="badge badge-error badge-sm">Error</span>'
            : result.result === null 
            ? '<span class="badge badge-outline badge-sm">Not Found</span>'
            : `<span class="badge badge-sm ${
                result.result?.status === 'malicious' ? 'badge-error'
                : result.result?.status === 'suspicious' ? 'badge-warning'
                : 'badge-success'
              }">${result.result?.status || 'Unknown'}</span>`
          }
        </td>
        <td class="text-xs">
          ${result.error ? `<span class="text-error">${result.error}</span>` : ''}
          ${result.result ? `
            <div class="space-y-1">
              ${source === 'AbuseIPDB' && result.result.risk_score !== undefined
                ? `<p>Risk Score: <span class="font-semibold">${result.result.risk_score}%</span></p>`
                : ''
              }
              ${source === 'VirusTotal' && result.result.malicious !== undefined
                ? `<p>Detections: <span class="font-semibold">${result.result.malicious + result.result.suspicious}/${result.result.malicious + result.result.suspicious + result.result.undetected + result.result.harmless}</span></p>`
                : ''
              }
              ${source === 'OTX Alienvault' && result.result.pulse_count !== undefined
                ? `<p>Pulses: <span class="font-semibold">${result.result.pulse_count}</span></p>`
                : ''
              }
              ${result.result.reputation !== undefined
                ? `<p>Reputation: <span class="font-semibold">${result.result.reputation}</span></p>`
                : ''
              }
            </div>
          ` : ''}
        </td>
        <td>
          <button class="btn btn-ghost btn-xs detailsBtn" data-idx="${idx}">Details</button>
        </td>
      </tr>
    `).join('')

    const html = `
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <div>
            <p class="text-sm text-base-content/60">
              Mode: <span class="font-semibold">${mode}</span> | Source: <span class="font-semibold">${source}</span>
            </p>
            <p class="text-sm text-base-content/60">
              Total Indicators: <span class="font-semibold">${indicators.length}</span>
            </p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="table table-sm table-zebra w-full">
            <thead>
              <tr class="border-base-300">
                <th>Indicator</th>
                <th>Status</th>
                <th>Details</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${resultsHTML}
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
      </div>
      <div id="resultsData" style="display:none" data-results="${JSON.stringify({mode, source, results}).replace(/"/g, '&quot;')}"></div>
    `

    return c.html(html)
  } catch (error) {
    console.error('Check error:', error)
    return c.html(
      <div class="alert alert-error alert-soft">
        <span>
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </span>
      </div>
    )
  }
})

intelligence.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Threat Intelligence Checker</title>
  <link rel="stylesheet" href="/src/style.css">
</head>
<body class="bg-base-200">
  <div class="drawer lg:drawer-open">
    <input id="sidebar" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content flex flex-col">
      <div class="navbar bg-base-100 border-b border-base-300 shadow-md sticky top-0 z-40">
        <div class="flex-1 px-4">
          <h1 class="text-xl font-bold">Threat Intelligence Checker</h1>
        </div>
      </div>
      <main class="p-4 md:p-8 flex-1">
        <div class="space-y-6">
          <div class="mb-8">
            <h1 class="text-4xl font-bold mb-3">Threat Intelligence Checker</h1>
            <p class="text-lg text-base-content/70">Analyze indicators across 7 premium threat intelligence sources</p>
          </div>

          <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <div class="stat bg-base-100 shadow-md border border-base-300 rounded-lg">
              <div class="stat-figure text-3xl">📊</div>
              <div class="stat-title text-sm opacity-70">Sources</div>
              <div class="stat-value text-primary text-2xl">7</div>
            </div>
            <div class="stat bg-base-100 shadow-md border border-base-300 rounded-lg">
              <div class="stat-figure text-3xl">✓</div>
              <div class="stat-title text-sm opacity-70">Checks Today</div>
              <div class="stat-value text-success text-2xl">44</div>
            </div>
            <div class="stat bg-base-100 shadow-md border border-base-300 rounded-lg">
              <div class="stat-figure text-3xl">⚡</div>
              <div class="stat-title text-sm opacity-70">Avg Speed</div>
              <div class="stat-value text-info text-2xl">1.2s</div>
            </div>
            <div class="stat bg-base-100 shadow-md border border-base-300 rounded-lg">
              <div class="stat-figure text-3xl">🛡️</div>
              <div class="stat-title text-sm opacity-70">Malicious Indicators</div>
              <div class="stat-value text-warning text-2xl">12</div>
            </div>
          </div>

          <div class="card bg-base-100 shadow-md border border-base-300">
            <div class="card-body">
              <h2 class="card-title">🔍 Check Indicators</h2>
              <form id="checkForm" class="form-control gap-6" onsubmit="handleFormSubmit(event)">
                <div class="mb-4">
                  <label class="label">
                    <span class="label-text font-semibold">Mode</span>
                    <span class="text-xs text-base-content/60">(Auto-detected based on input)</span>
                  </label>
                  <div class="flex gap-2 flex-wrap">
                    <button type="button" class="btn btn-sm btn-primary modeBtn" data-mode="Single Mode">Single Mode</button>
                    <button type="button" class="btn btn-sm btn-outline modeBtn" data-mode="Bulk Mode">Bulk Mode</button>
                    <button type="button" class="btn btn-sm btn-outline modeBtn" data-mode="Combined Analysis">Combined Analysis</button>
                  </div>
                  <input type="hidden" name="mode" id="modeInput" value="Single Mode" />
                </div>

                <div class="mb-4">
                  <label class="label">
                    <span class="label-text font-semibold">Select Sources</span>
                  </label>
                  <div class="flex flex-wrap gap-3" id="sourceRadios">
                    <label class="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors opacity-50 cursor-not-allowed">
                      <input type="radio" name="source" value="SOC Radar" disabled class="radio radio-primary radio-sm" />
                      <span class="text-sm font-medium line-through">SOC Radar</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors hover:bg-base-200">
                      <input type="radio" name="source" value="VirusTotal" class="radio radio-primary radio-sm" />
                      <span class="text-sm font-medium">VirusTotal</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors hover:bg-base-200">
                      <input type="radio" name="source" value="AbuseIPDB" checked class="radio radio-primary radio-sm" />
                      <span class="text-sm font-medium">AbuseIPDB</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors opacity-50 cursor-not-allowed">
                      <input type="radio" name="source" value="IBM X-Force" disabled class="radio radio-primary radio-sm" />
                      <span class="text-sm font-medium line-through">IBM X-Force</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors hover:bg-base-200">
                      <input type="radio" name="source" value="OTX Alienvault" class="radio radio-primary radio-sm" />
                      <span class="text-sm font-medium">OTX Alienvault</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors opacity-50 cursor-not-allowed">
                      <input type="radio" name="source" value="MXtoolbox" disabled class="radio radio-primary radio-sm" />
                      <span class="text-sm font-medium line-through">MXtoolbox</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors opacity-50 cursor-not-allowed">
                      <input type="radio" name="source" value="Cisco Talos" disabled class="radio radio-primary radio-sm" />
                      <span class="text-sm font-medium line-through">Cisco Talos</span>
                    </label>
                  </div>
                  <p class="text-xs text-base-content/60 mt-2">Other sources coming soon</p>
                </div>

                <textarea
                  name="indicators"
                  id="indicatorsInput"
                  placeholder="Enter indicators (one per line):
- Single line for Single Mode
- Multiple lines for Bulk Mode
- Up to 10 with correlation for Advanced Mode"
                  class="textarea textarea-bordered h-40 focus:textarea-primary w-full mb-4 resize-none"
                  onchange="updateModeFromInput()"
                  onkeyup="updateModeFromInput()"></textarea>

                <button type="submit" class="btn btn-primary w-full">Check Indicator</button>
              </form>
            </div>
          </div>

          <div class="card bg-base-100 shadow-md border border-base-300">
            <div class="card-body">
              <h2 class="card-title mb-4">Results</h2>
              <div id="resultsArea" class="alert alert-info alert-soft">
                <span>Enter an indicator and select a source to see results here</span>
              </div>
            </div>
          </div>

          <div class="grid gap-4 grid-cols-1 md:grid-cols-3">
            <div class="card bg-base-100 shadow-md border border-base-300">
              <div class="card-body">
                <h2 class="card-title text-lg mb-2">
                  <span class="text-3xl">1️⃣</span>
                  <span>Single Mode</span>
                </h2>
                <p class="text-sm text-base-content/70 mb-4">Check one indicator quickly</p>
                <div class="space-y-2">
                  <p class="text-xs"><strong>Supports:</strong></p>
                  <ul class="text-xs space-y-1 list-disc list-inside opacity-70">
                    <li>IPv4 & IPv6 addresses</li>
                    <li>Domains & subdomains</li>
                    <li>URLs & file paths</li>
                    <li>File hashes (MD5, SHA-1, SHA-256)</li>
                  </ul>
                </div>
              </div>
            </div>

            <div class="card bg-base-100 shadow-md border border-base-300">
              <div class="card-body">
                <h2 class="card-title text-lg mb-2">
                  <span class="text-3xl">📋</span>
                  <span>Bulk Mode</span>
                </h2>
                <p class="text-sm text-base-content/70 mb-4">Check multiple indicators at once</p>
                <div class="space-y-2">
                  <p class="text-xs"><strong>Limits:</strong></p>
                  <ul class="text-xs space-y-1 list-disc list-inside opacity-70">
                    <li>Up to 100 indicators</li>
                    <li>One per line</li>
                    <li>Mixed types supported</li>
                    <li>Results exported to CSV</li>
                  </ul>
                </div>
              </div>
            </div>

            <div class="card bg-base-100 shadow-md border border-base-300">
              <div class="card-body">
                <h2 class="card-title text-lg mb-2">
                  <span class="text-3xl">🔗</span>
                  <span>Advanced</span>
                </h2>
                <p class="text-sm text-base-content/70 mb-4">Correlate & analyze together</p>
                <div class="space-y-2">
                  <p class="text-xs"><strong>Features:</strong></p>
                  <ul class="text-xs space-y-1 list-disc list-inside opacity-70">
                    <li>Up to 10 indicators</li>
                    <li>Correlation analysis</li>
                    <li>Campaign tracking</li>
                    <li>Report generation</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div class="alert alert-info alert-soft">
            <div class="flex gap-3">
              <span class="text-xl">ℹ️</span>
              <div>
                <h3 class="font-bold">Need Help?</h3>
                <p class="text-sm">Check our documentation for API integration, bulk import guides, and source accuracy rates.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>

  <script>
    let selectedMode = 'Single Mode';

    function updateModeFromInput() {
      const textarea = document.getElementById('indicatorsInput');
      const lines = textarea.value.trim().split('\\n').filter(l => l.trim());

      if (lines.length === 1) {
        setMode('Single Mode');
      } else if (lines.length > 1 && lines.length <= 100) {
        setMode('Bulk Mode');
      }
    }

    function setMode(mode) {
      selectedMode = mode;
      document.getElementById('modeInput').value = mode;

      document.querySelectorAll('.modeBtn').forEach(btn => {
        if (btn.getAttribute('data-mode') === mode) {
          btn.classList.remove('btn-outline');
          btn.classList.add('btn-primary');
        } else {
          btn.classList.add('btn-outline');
          btn.classList.remove('btn-primary');
        }
      });
    }

    async function handleFormSubmit(event) {
      event.preventDefault();
      const form = event.target;
      const formData = new FormData(form);

      const resultsArea = document.getElementById('resultsArea');
      resultsArea.innerHTML = '<div class="loading loading-spinner loading-lg"></div>';

      try {
        const response = await fetch('/intelligence/api/check', {
          method: 'POST',
          body: formData
        });

        const html = await response.text();
        resultsArea.innerHTML = html;

        // Attach listeners to Details buttons
        resultsArea.querySelectorAll('.detailsBtn').forEach(btn => {
          btn.addEventListener('click', function() {
            const idx = this.getAttribute('data-idx');
            alert('Details for result #' + (parseInt(idx) + 1) + ' - Full details view coming soon!');
          });
        });

        const newCheckBtn = resultsArea.querySelector('#newCheckBtn');
        if (newCheckBtn) {
          newCheckBtn.addEventListener('click', function() {
            document.getElementById('resultsArea').innerHTML = '<div class="alert alert-info alert-soft"><span>Ready for new check</span></div>';
            document.getElementById('indicatorsInput').value = '';
            document.getElementById('indicatorsInput').focus();
          });
        }

        const copyJsonBtn = resultsArea.querySelector('#copyJsonBtn');
        if (copyJsonBtn) {
          copyJsonBtn.addEventListener('click', function() {
            const resultsData = resultsArea.querySelector('#resultsData');
            if (resultsData) {
              try {
                const dataStr = resultsData.getAttribute('data-results');
                const data = JSON.parse(dataStr);
                navigator.clipboard.writeText(JSON.stringify(data, null, 2));
              } catch (e) {
                console.error('Error parsing results data:', e);
              }
            }
          });
        }
      } catch (error) {
        resultsArea.innerHTML = '<div class="alert alert-error alert-soft"><span>Error: ' + error.message + '</span></div>';
      }
    }

    document.querySelectorAll('.modeBtn').forEach(btn => {
      btn.addEventListener('click', function() {
        const mode = this.getAttribute('data-mode');
        setMode(mode);
      });
    });

    document.querySelector('input[name="source"][value="AbuseIPDB"]').checked = true;
  </script>
</body>
</html>`

  return c.html(html)
})

export default intelligence

