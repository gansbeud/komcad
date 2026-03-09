import { Hono } from 'hono'
import { lookupIP } from '../lib/whois'

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

  return c.html(
    <div class="space-y-4">
      {/* Summary bar */}
      <div class="flex items-center gap-3 flex-wrap">
        <span class="badge badge-success badge-lg">{ok.length} resolved</span>
        {bad.length > 0 && (
          <span class="badge badge-error badge-lg">{bad.length} failed</span>
        )}
        <span class="text-xs opacity-50">via ipinfo.io Lite API</span>
      </div>

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
  function handleSubmit(e) {
    e.preventDefault();
    var results = document.getElementById('whoisResults');
    results.innerHTML = '<div class="flex justify-center py-6"><span class="loading loading-spinner loading-lg"></span></div>';
    fetch('/whois/api/lookup', { method: 'POST', body: new FormData(e.target) })
      .then(function (r) { return r.text(); })
      .then(function (html) { results.innerHTML = html; })
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
        var results = document.getElementById('whoisResults');
        if (results) results.innerHTML = '<div class="alert alert-info alert-soft"><span>Enter IP addresses above and click Lookup All</span></div>';
      });
    }
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
