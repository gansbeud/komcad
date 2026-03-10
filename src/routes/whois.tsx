import { Hono } from 'hono'
import { lookupIP } from '../lib/whois'
import { logCheckEvents } from '../lib/checklog'

const whois = new Hono<{ Bindings: { IPINFO_API_KEY?: string } }>()

// POST /whois/api/lookup — bulk lookup, returns HTML table fragment
whois.post('/api/lookup', async (c) => {
  const form    = await c.req.formData()
  const raw     = (form.get('queries') as string ?? '').trim()
  const queries = raw.split('\n').map((l) => l.trim()).filter(Boolean)

  if (queries.length === 0) {
    return c.html(
      <div class="alert alert-warning alert-soft">
        <span>Please enter at least one IP address.</span>
      </div>
    )
  }

  const apiKey = (c.env as any)?.IPINFO_API_KEY ?? ''
  if (!apiKey) {
    return c.html(
      <div class="alert alert-error alert-soft">
        <span>IPINFO_API_KEY is not configured in environment variables.</span>
      </div>
    )
  }

  // Fetch all in parallel
  const results = await Promise.all(
    queries.map(async (ip) => {
      try {
        const r = await lookupIP(ip, apiKey)
        return { ip, ok: true, data: r, error: '' }
      } catch (err) {
        return { ip, ok: false, data: null, error: err instanceof Error ? err.message : 'Lookup failed' }
      }
    })
  )

  const ok  = results.filter((r) => r.ok)
  const bad = results.filter((r) => !r.ok)

  // Log each lookup result
  const _username = (c as any).get?.('username') as string ?? 'unknown'
  void logCheckEvents('whois', 'whois', 'ipinfo.io', [
    ...ok.map((r) => ({
      indicator: r.data!.ip || r.ip,
      result: 'success' as const,
      summary: JSON.stringify({ org: r.data!.org || null, city: r.data!.city || null, region: r.data!.region || null, country: r.data!.country || null, hostname: r.data!.hostname || null }),
    })),
    ...bad.map((r) => ({
      indicator: r.ip,
      result: 'error' as const,
      detail: r.error,
    })),
  ], c.req.raw, { username: _username })

  // Build JSON payload for client-side button actions
  const payload = ok.map((r) => ({
    ip:       r.data!.ip       || r.ip,
    hostname: r.data!.hostname || '',
    org:      r.data!.org      || '',
    city:     r.data!.city     || '',
    region:   r.data!.region   || '',
    country:  r.data!.country  || '',
    timezone: r.data!.timezone || '',
  }))

  return c.html(
    <div class="space-y-4" id="whois-results-block">
      {/* Summary + action buttons */}
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="badge badge-success badge-lg">{ok.length} resolved</span>
          {bad.length > 0 && (
            <span class="badge badge-error badge-lg">{bad.length} failed</span>
          )}
          <span class="text-xs opacity-50">via ipinfo.io Lite API</span>
        </div>
        <div class="flex gap-1 flex-wrap" id="whois-action-btns">
          <button class="btn btn-xs btn-ghost" id="wh-new-check">🔄 New Check</button>
          <button class="btn btn-xs btn-outline" id="wh-copy-clip">📋 Copy to Clipboard</button>
          <button class="btn btn-xs btn-outline" id="wh-export-csv">📥 Export CSV</button>
          <button class="btn btn-xs btn-primary btn-outline" id="wh-copy-fmt">⊕ Copy Formatted IP</button>
        </div>
      </div>
      {/* Hidden data payload for JS */}
      <script id="whois-payload" type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
      />

      {/* Results table */}
      {ok.length > 0 && (
        <div class="overflow-x-auto">
          <table class="table table-sm table-zebra w-full">
            <thead>
              <tr>
                <th>IP</th>
                <th>Hostname</th>
                <th>Org</th>
                <th>City</th>
                <th>Region</th>
                <th>Country</th>
                <th>Timezone</th>
              </tr>
            </thead>
            <tbody>
              {ok.map((r) => {
                const d = r.data!
                const flag = d.country ? countryFlag(d.country) : ''
                return (
                  <tr key={r.ip}>
                    <td class="font-mono text-xs font-semibold">{d.ip || r.ip}</td>
                    <td class="font-mono text-xs opacity-70">{d.hostname || '—'}</td>
                    <td class="text-xs">{d.org || '—'}</td>
                    <td class="text-xs">{d.city || '—'}</td>
                    <td class="text-xs">{d.region || '—'}</td>
                    <td class="text-xs">{flag} {d.country || '—'}</td>
                    <td class="text-xs">{d.timezone || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Failed lookups */}
      {bad.length > 0 && (
        <div class="space-y-1">
          <p class="text-xs font-semibold opacity-60">Failed lookups:</p>
          {bad.map((r) => (
            <div key={r.ip} class="alert alert-error alert-soft py-1 text-xs">
              <span class="font-mono">{r.ip}</span>
              <span class="mx-2 opacity-50">—</span>
              <span>{r.error}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

// GET /whois — full page
whois.get('/', (c) => {
  return c.render(
    <div class="space-y-6">
      {/* Header */}
      <div>
        <h1 class="text-3xl font-bold mb-1">🌐 Bulk Whois Lookup</h1>
        <p class="text-base-content/70 text-sm">
          Query multiple IP addresses at once using the ipinfo.io Lite API
        </p>
      </div>

      {/* Stats */}
      <div class="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {[
          { icon: '🌐', label: 'Data Source', value: 'ipinfo.io' },
          { icon: '⚡', label: 'API Type', value: 'Lite (Free)' },
          { icon: '🔢', label: 'Input Type', value: 'IPs only' },
        ].map((s) => (
          <div key={s.label} class="stat bg-base-100 shadow-sm border border-base-300 rounded-lg">
            <div class="stat-figure text-2xl">{s.icon}</div>
            <div class="stat-title text-xs">{s.label}</div>
            <div class="stat-value text-lg">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Lookup form */}
      <div class="card bg-base-100 shadow-md border border-base-300">
        <div class="card-body gap-4">
          <h2 class="card-title text-lg">🔍 Bulk IP Lookup</h2>

          <form id="whoisForm">
            <div class="flex flex-col gap-3">
              <textarea
                name="queries"
                id="whoisInput"
                rows={6}
                placeholder={'Enter IP addresses, one per line\n8.8.8.8\n1.1.1.1\n8.8.4.4'}
                class="textarea textarea-bordered w-full font-mono text-sm focus:textarea-primary resize-y"
                required
              />
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <p class="text-xs text-base-content/50">
                  IPv4 and IPv6 supported. One address per line.
                </p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    id="whoisClearBtn"
                    class="btn btn-sm btn-ghost"
                  >
                    Clear
                  </button>
                  <button type="submit" class="btn btn-sm btn-primary">
                    Lookup All
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Results area */}
      <div class="card bg-base-100 shadow-md border border-base-300">
        <div class="card-body">
          <h2 class="card-title mb-2">Results</h2>
          <div id="whoisResults" class="alert alert-info alert-soft">
            <span>Enter IP addresses above and click Lookup All</span>
          </div>
        </div>
      </div>

      {/* Client JS */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function () {
  function resetResults() {
    var r = document.getElementById('whoisResults');
    if (r) r.innerHTML = '<div class="alert alert-info alert-soft"><span>Enter IP addresses above and click Lookup All</span></div>';
  }

  function getPayload() {
    var el = document.getElementById('whois-payload');
    if (!el) return [];
    try { return JSON.parse(el.textContent || '[]'); } catch { return []; }
  }

  function getTableRows() {
    var tbl = document.querySelector('#whoisResults table');
    if (!tbl) return { headers: [], rows: [] };
    var headers = Array.from(tbl.querySelectorAll('thead th')).map(function(th) { return th.textContent.trim(); });
    var rows = Array.from(tbl.querySelectorAll('tbody tr')).map(function(tr) {
      return Array.from(tr.querySelectorAll('td')).map(function(td) { return td.textContent.trim(); });
    });
    return { headers: headers, rows: rows };
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).then(function() {
      showToast('Copied to clipboard!');
    }).catch(function() {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      showToast('Copied!');
    });
  }

  function showToast(msg) {
    var t = document.createElement('div');
    t.className = 'toast toast-top toast-end z-50';
    t.innerHTML = '<div class="alert alert-success text-xs py-2">' + msg + '</div>';
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 2500);
  }

  function bindActionBtns() {
    var newChk = document.getElementById('wh-new-check');
    if (newChk && !newChk._bound) {
      newChk._bound = true;
      newChk.addEventListener('click', function() {
        resetResults();
        var inp = document.getElementById('whoisInput');
        if (inp) { inp.value = ''; inp.focus(); }
      });
    }

    var copyClip = document.getElementById('wh-copy-clip');
    if (copyClip && !copyClip._bound) {
      copyClip._bound = true;
      copyClip.addEventListener('click', function() {
        var d = getTableRows();
        if (!d.rows.length) return;
        var lines = [d.headers.join('\\t')].concat(d.rows.map(function(r) { return r.join('\\t'); }));
        copyText(lines.join('\\n'));
      });
    }

    var expCsv = document.getElementById('wh-export-csv');
    if (expCsv && !expCsv._bound) {
      expCsv._bound = true;
      expCsv.addEventListener('click', function() {
        var d = getTableRows();
        if (!d.rows.length) return;
        function q(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }
        var csv = [d.headers.map(q).join(',')].concat(d.rows.map(function(r) { return r.map(q).join(','); })).join('\\n');
        var blob = new Blob([csv], { type: 'text/csv' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'whois-' + new Date().toISOString().slice(0,10) + '.csv';
        a.click();
        showToast('CSV downloaded');
      });
    }

    var copyFmt = document.getElementById('wh-copy-fmt');
    if (copyFmt && !copyFmt._bound) {
      copyFmt._bound = true;
      copyFmt.addEventListener('click', function() {
        var data = getPayload();
        if (!data.length) return;
        var entries = data.map(function(r) {
          var hostname = r.hostname || '-';
          var cc = r.country || '-';
          return r.ip + ' (' + hostname + ',' + cc + ')';
        });
        copyText(entries.join(', '));
      });
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    var results = document.getElementById('whoisResults');
    results.innerHTML = '<div class="flex justify-center py-6"><span class="loading loading-spinner loading-lg"></span></div>';
    fetch('/whois/api/lookup', { method: 'POST', body: new FormData(e.target) })
      .then(function (r) { return r.text(); })
      .then(function (html) { results.innerHTML = html; bindActionBtns(); })
      .catch(function (err) {
        results.innerHTML = '<div class="alert alert-error alert-soft"><span>Error: ' + err.message + '</span></div>';
      });
  }

  function bind() {
    var form = document.getElementById('whoisForm');
    if (form && !form._bound) {
      form._bound = true;
      form.addEventListener('submit', handleSubmit);
    }
    var clearBtn = document.getElementById('whoisClearBtn');
    if (clearBtn && !clearBtn._bound) {
      clearBtn._bound = true;
      clearBtn.addEventListener('click', function () {
        var inp = document.getElementById('whoisInput');
        if (inp) inp.value = '';
        resetResults();
      });
    }
    bindActionBtns();
  }

  bind();
  document.addEventListener('htmx:afterSettle', bind);
})();
          `,
        }}
      />
    </div>,
    { title: 'Bulk Whois' }
  )
})

// Utility: convert ISO country code to flag emoji
function countryFlag(code: string): string {
  return [...code.toUpperCase()]
    .map((ch) => String.fromCodePoint(0x1f1e6 - 65 + ch.charCodeAt(0)))
    .join('')
}

export default whois
