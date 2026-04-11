import { Hono } from 'hono'
import { getDB, query, queryOne } from '../lib/db'

const dashboardMock = new Hono()

interface OverviewRow {
  total_checks: number
  malicious_checks: number
  error_checks: number
  unique_indicators: number
}

interface SessionRow {
  active_sessions: number
}

interface HourlyTrendRow {
  hour: string
  total_checks: number
  malicious_checks: number
}

interface ServiceRow {
  service: string
  total: number
  malicious: number
}

interface AuthRow {
  event: string
  total: number
}

interface ThreatRow {
  id: string
  indicator: string
  service: string
  source: string
  ip_address: string
  created_at: string
  summary_json: string
}

interface HotIndicatorRow {
  indicator: string
  hits: number
  last_seen: string
}

function summarizeThreat(summary: string): { severity: 'critical' | 'high' | 'medium' | 'low'; verdict: string } {
  try {
    const s = JSON.parse(summary)
    const statuses: string[] = []
    if (s.status) statuses.push(String(s.status).toLowerCase())
    if (s.abdb?.status) statuses.push(String(s.abdb.status).toLowerCase())
    if (s.vt?.status) statuses.push(String(s.vt.status).toLowerCase())
    if (s.otx?.status) statuses.push(String(s.otx.status).toLowerCase())
    if (s.tfox?.status) statuses.push(String(s.tfox.status).toLowerCase())

    if (statuses.includes('malicious')) return { severity: 'critical', verdict: 'malicious' }
    if (statuses.includes('suspicious')) return { severity: 'high', verdict: 'suspicious' }

    const score = Number(s.score ?? s.abdb?.score ?? 0)
    if (score >= 80) return { severity: 'critical', verdict: 'high score' }
    if (score >= 50) return { severity: 'high', verdict: 'elevated score' }
    if (score >= 20) return { severity: 'medium', verdict: 'watchlist' }
    return { severity: 'low', verdict: 'low confidence' }
  } catch {
    return { severity: 'medium', verdict: 'needs review' }
  }
}

dashboardMock.get('/', async (c) => {
  const db = getDB(c)

  const overview = await queryOne<OverviewRow>(
    db,
    `
      SELECT
        COUNT(*) AS total_checks,
        SUM(CASE WHEN is_malicious = 1 THEN 1 ELSE 0 END) AS malicious_checks,
        SUM(CASE WHEN result LIKE '%"error"%' THEN 1 ELSE 0 END) AS error_checks,
        COUNT(DISTINCT indicator) AS unique_indicators
      FROM check_logs
    `
  )

  const sessions = await queryOne<SessionRow>(
    db,
    `
      SELECT COUNT(*) AS active_sessions
      FROM sessions
      WHERE is_active = 1
        AND julianday(expires_at) > julianday('now')
    `
  )

  const hourlyTrendRows = await query<HourlyTrendRow>(
    db,
    `
      WITH RECURSIVE hourly_window(step, hour_ts) AS (
        SELECT 0, strftime('%Y-%m-%d %H:00:00', 'now', '-167 hours')
        UNION ALL
        SELECT
          step + 1,
          strftime('%Y-%m-%d %H:00:00', hour_ts, '+1 hour')
        FROM hourly_window
        WHERE step < 167
      ),
      rollup AS (
        SELECT
          strftime('%Y-%m-%d %H:00:00', created_at) AS hour_ts,
          COUNT(*) AS total_checks,
          SUM(CASE WHEN is_malicious = 1 THEN 1 ELSE 0 END) AS malicious_checks
        FROM check_logs
        WHERE julianday(created_at) >= julianday('now', '-7 days')
        GROUP BY strftime('%Y-%m-%d %H:00:00', created_at)
      )
      SELECT
        hourly_window.hour_ts AS hour,
        COALESCE(rollup.total_checks, 0) AS total_checks,
        COALESCE(rollup.malicious_checks, 0) AS malicious_checks
      FROM hourly_window
      LEFT JOIN rollup ON rollup.hour_ts = hourly_window.hour_ts
      ORDER BY hourly_window.hour_ts ASC
    `
  )

  const serviceRows = await query<ServiceRow>(
    db,
    `
      SELECT
        service,
        COUNT(*) AS total,
        SUM(CASE WHEN is_malicious = 1 THEN 1 ELSE 0 END) AS malicious
      FROM check_logs
      WHERE julianday(created_at) >= julianday('now', '-7 days')
      GROUP BY service
      ORDER BY total DESC
      LIMIT 8
    `
  )

  const authRows = await query<AuthRow>(
    db,
    `
      SELECT event, COUNT(*) AS total
      FROM auth_logs
      WHERE julianday(created_at) >= julianday('now', '-7 days')
      GROUP BY event
      ORDER BY total DESC
    `
  )

  const threatRows = await query<ThreatRow>(
    db,
    `
      SELECT id, indicator, service, source, ip_address, created_at, summary_json
      FROM check_logs
      WHERE is_malicious = 1
      ORDER BY created_at DESC
      LIMIT 8
    `
  )

  const hotIndicators = await query<HotIndicatorRow>(
    db,
    `
      SELECT indicator, COUNT(*) AS hits, MAX(created_at) AS last_seen
      FROM check_logs
      WHERE is_malicious = 1
      GROUP BY indicator
      ORDER BY hits DESC, last_seen DESC
      LIMIT 6
    `
  )

  const payload = {
    trends: hourlyTrendRows,
    services: serviceRows,
    auth: authRows,
  }

  const totalChecks = Number(overview?.total_checks ?? 0)
  const maliciousChecks = Number(overview?.malicious_checks ?? 0)
  const errorChecks = Number(overview?.error_checks ?? 0)
  const uniqueIndicators = Number(overview?.unique_indicators ?? 0)
  const activeSessions = Number(sessions?.active_sessions ?? 0)
  const maliciousRate = totalChecks > 0 ? Math.round((maliciousChecks / totalChecks) * 100) : 0

  return c.render(
    <div class="space-y-6">
      <div class="card bg-gradient-to-r from-base-200 via-base-100 to-base-200 border border-base-300 shadow-lg">
        <div class="card-body py-5">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 class="text-2xl sm:text-3xl font-bold">Security Operations Dashboard</h1>
              <p class="text-sm opacity-70">Live visualization from D1 audit and intelligence telemetry.</p>
            </div>
            <div class="flex items-center gap-2">
              <span class={`badge ${maliciousRate >= 50 ? 'badge-error' : maliciousRate >= 20 ? 'badge-warning' : 'badge-success'} badge-lg`}>
                Malicious Rate: {maliciousRate}%
              </span>
              <a
                href="/intelligence"
                {...{ 'hx-get': '/intelligence', 'hx-target': '#page-content', 'hx-push-url': 'true', 'hx-swap': 'innerHTML' }}
                class="btn btn-primary btn-sm"
              >
                Run Intelligence Check
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm">
          <div class="stat-title">Total Checks</div>
          <div class="stat-value text-primary">{totalChecks}</div>
          <div class="stat-desc">All-time intelligence queries</div>
        </div>
        <div class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm">
          <div class="stat-title">Malicious Hits</div>
          <div class="stat-value text-error">{maliciousChecks}</div>
          <div class="stat-desc">Flagged by any source</div>
        </div>
        <div class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm">
          <div class="stat-title">Errors Logged</div>
          <div class="stat-value text-warning">{errorChecks}</div>
          <div class="stat-desc">Provider/API failures</div>
        </div>
        <div class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm">
          <div class="stat-title">Unique Indicators</div>
          <div class="stat-value text-info">{uniqueIndicators}</div>
          <div class="stat-desc">Distinct IPs/domains/hashes</div>
        </div>
        <div class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm">
          <div class="stat-title">Active Sessions</div>
          <div class="stat-value text-success">{activeSessions}</div>
          <div class="stat-desc">Unexpired authenticated sessions</div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div class="card bg-base-100 border border-base-300 shadow-md">
          <div class="card-body">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h2 class="card-title">Check Activity</h2>
                <p class="text-sm opacity-70">7-day window, hourly check volume.</p>
              </div>
              <span class="badge badge-outline">7d hourly</span>
            </div>
            <div class="h-80 rounded-xl bg-base-200/60 p-2">
              <canvas id="checkActivityChart" style="width:100%;height:100%;display:block;"></canvas>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300 shadow-md">
          <div class="card-body">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h2 class="card-title">Threat Detected</h2>
                <p class="text-sm opacity-70">7-day window, hourly malicious detections.</p>
              </div>
              <span class="badge badge-outline">7d hourly</span>
            </div>
            <div class="h-80 rounded-xl bg-base-200/60 p-2">
              <canvas id="threatDetectedChart" style="width:100%;height:100%;display:block;"></canvas>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card bg-base-100 border border-base-300 shadow-md">
          <div class="card-body">
            <h2 class="card-title">Auth Event Distribution (7 Days)</h2>
            <div class="flex flex-wrap gap-2 mt-1">
              {authRows.length === 0
                ? <span class="badge badge-ghost">No auth events in window</span>
                : authRows.map((row) => (
                    <span
                      key={row.event}
                      class={`badge ${row.event.includes('failure') ? 'badge-error' : row.event.includes('success') ? 'badge-success' : 'badge-neutral'}`}
                    >
                      {row.event}: {row.total}
                    </span>
                  ))}
            </div>
            <div class="divider my-2"></div>
            <h3 class="font-semibold text-sm opacity-80">Hot Indicators</h3>
            <div class="space-y-2 mt-2">
              {hotIndicators.length === 0
                ? <div class="alert alert-soft"><span>No malicious indicator hotspots yet.</span></div>
                : hotIndicators.map((row) => (
                    <div key={row.indicator} class="flex items-center justify-between bg-base-200/60 rounded-lg px-3 py-2">
                      <div class="min-w-0">
                        <p class="font-mono text-xs truncate">{row.indicator}</p>
                        <p class="text-xs opacity-60">Last seen {new Date(row.last_seen).toLocaleString('en-GB')}</p>
                      </div>
                      <span class="badge badge-error badge-sm">{row.hits} hits</span>
                    </div>
                  ))}
            </div>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300 shadow-md">
          <div class="card-body">
            <div class="flex items-center justify-between">
              <h2 class="card-title">Latest Malicious Events</h2>
              <span class="badge badge-outline">Newest first</span>
            </div>
            <div class="overflow-x-auto mt-2">
              <table class="table table-zebra table-sm">
                <thead>
                  <tr>
                    <th>Indicator</th>
                    <th>Service</th>
                    <th>Severity</th>
                    <th>Verdict</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {threatRows.length === 0
                    ? <tr><td colSpan={5} class="text-center opacity-60">No malicious events found.</td></tr>
                    : threatRows.map((threat) => {
                        const parsed = summarizeThreat(threat.summary_json)
                        const sevBadge = parsed.severity === 'critical'
                          ? 'badge-error'
                          : parsed.severity === 'high'
                            ? 'badge-warning'
                            : parsed.severity === 'medium'
                              ? 'badge-info'
                              : 'badge-success'
                        return (
                          <tr key={threat.id}>
                            <td>
                              <div class="font-mono text-xs max-w-44 truncate" title={threat.indicator}>{threat.indicator}</div>
                              <div class="text-[11px] opacity-60">{threat.ip_address}</div>
                            </td>
                            <td>
                              <span class="badge badge-outline badge-sm">{threat.service}</span>
                            </td>
                            <td><span class={`badge badge-sm ${sevBadge}`}>{parsed.severity}</span></td>
                            <td class="text-xs">{parsed.verdict}</td>
                            <td class="text-xs whitespace-nowrap">{new Date(threat.created_at).toLocaleString('en-GB')}</td>
                          </tr>
                        )
                      })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <script id="dashboard-payload" type="application/json" dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }} />
      <script dangerouslySetInnerHTML={{ __html: `
(function(){
  function prepareCanvas(canvas){
    if(!canvas) return null;
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    if(!rect.width || !rect.height) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    if(!ctx) return null;
    ctx.scale(dpr, dpr);
    return { ctx: ctx, width: rect.width, height: rect.height };
  }
  function readPayload(){
    var el = document.getElementById('dashboard-payload');
    if(!el) return { trends: [], services: [], auth: [] };
    try { return JSON.parse(el.textContent || '{}'); } catch { return { trends: [], services: [], auth: [] }; }
  }
  function drawHourlyLineChart(canvasId, data, valueKey, lineColor, fillColor){
    var prep = prepareCanvas(document.getElementById(canvasId));
    if(!prep) return;
    var ctx = prep.ctx, W = prep.width, H = prep.height;
    var p = { t: 20, r: 16, b: 34, l: 34 };
    var cw = W - p.l - p.r, ch = H - p.t - p.b;
    var labels = data.map(function(d){
      var hour = String(d.hour || '');
      return hour.slice(5, 10) + ' ' + hour.slice(11, 13) + ':00';
    });
    var series = data.map(function(d){ return Number(d[valueKey] || 0); });
    var maxV = Math.max.apply(null, series.concat([1]));
    for(var g=0; g<=4; g++){
      var y = p.t + (ch/4)*g;
      ctx.strokeStyle = 'rgba(140,140,140,0.16)';
      ctx.beginPath(); ctx.moveTo(p.l, y); ctx.lineTo(p.l+cw, y); ctx.stroke();
    }
    if(series.length > 0){
      ctx.beginPath();
      series.forEach(function(v, i){
        var x = p.l + (series.length === 1 ? cw/2 : (cw/(series.length-1))*i);
        var y = p.t + ch - (Number(v)/maxV)*ch;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = lineColor;
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.lineTo(p.l + cw, p.t + ch);
      ctx.lineTo(p.l, p.t + ch);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(120,120,120,0.8)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    labels.forEach(function(lbl, i){
      var x = p.l + (labels.length === 1 ? cw/2 : (cw/(labels.length-1))*i);
      if(i % 24 === 0 || i === labels.length - 1) ctx.fillText(lbl, x, H-10);
    });
  }
  function drawAll(){
    var payload = readPayload();
    var trends = Array.isArray(payload.trends) ? payload.trends : [];
    drawHourlyLineChart('checkActivityChart', trends, 'total_checks', '#0ea5e9', 'rgba(14,165,233,0.14)');
    drawHourlyLineChart('threatDetectedChart', trends, 'malicious_checks', '#ef4444', 'rgba(239,68,68,0.14)');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', drawAll); else drawAll();
  window.addEventListener('resize', drawAll);
})();
            ` }} />
    </div>,
    // @ts-expect-error — Hono ContextRenderer not extended
    { title: 'Dashboard' }
  )
})

export default dashboardMock
