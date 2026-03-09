import { Hono } from 'hono'

const dashboardMock = new Hono()

dashboardMock.get('/', (c) => {
  return c.render(
    <div class="space-y-6">
      {/* HERO ALERT WITH CLOSE */}
      <div class="alert alert-error alert-soft shadow-lg border border-error/30">
        <div class="flex items-start justify-between w-full">
          <div class="flex items-start gap-3">
            <span class="text-2xl">🚨</span>
            <div>
              <h3 class="font-bold">Critical Threat Active</h3>
              <p class="text-sm opacity-90">DDoS attack detected on primary gateway - Response team notified</p>
            </div>
          </div>
          <button class="btn btn-xs btn-ghost">✕</button>
        </div>
      </div>

      {/* TOP STATS WITH ANIMATIONS */}
      <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-2">
        {[
          { icon: '🎯', title: 'Threats Detected', value: '247', desc: '↗ 12% from last week', color: 'error', trend: 'up', goodTrend: false },
          { icon: '✓', title: 'Blocked Attacks', value: '1,284', desc: '↗ 5.2% from last week', color: 'success', trend: 'up', goodTrend: true },
          { icon: '⚠️', title: 'Vulnerabilities', value: '42', desc: '↘ 3 patched this week', color: 'warning', trend: 'down', goodTrend: false },
          { icon: '📡', title: 'Network Uptime', value: '99.8%', desc: '↗ 0.1% from last month', color: 'info', trend: 'up', goodTrend: true }
        ].map((stat) => (
          <div key={stat.title} class="card bg-base-100 shadow-md hover:shadow-lg transition-all duration-300 border border-base-300 hover:border-base-400">
            <div class="card-body p-4">
              <div class="flex justify-between items-start">
                <div>
                  <div class="text-4xl mb-2">{stat.icon}</div>
                  <h3 class="text-xs font-bold opacity-70 uppercase">{stat.title}</h3>
                  <div class={`text-3xl font-bold mt-1 text-${stat.color}`}>{stat.value}</div>
                </div>
                <div class={`badge badge-outline text-xs ${ (stat.trend === 'up') === stat.goodTrend ? 'badge-success' : 'badge-error' }`}>
                  {stat.desc}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN CHARTS SECTION */}
      <div class="grid gap-6 grid-cols-1 lg:grid-cols-3 mb-6">
        {/* THREAT TIMELINE CHART */}
        <div class="card bg-base-100 shadow-md border border-base-300 lg:col-span-2">
          <div class="card-body">
            <div class="flex justify-between items-center mb-4">
              <div>
                <h2 class="card-title">Threat Detection Timeline</h2>
                <p class="text-sm opacity-60">Last 24 hours threat detection activity</p>
              </div>
              <div class="tabs tabs-boxed bg-base-200">
                <button class="tab tab-active tab-sm">24H</button>
                <button class="tab tab-sm">7D</button>
                <button class="tab tab-sm">30D</button>
              </div>
            </div>

            <div class="h-72 rounded-lg overflow-hidden bg-base-200 relative">
              <canvas id="threatTimelineChart" style="width:100%;height:100%;display:block;"></canvas>
            </div>

            <div class="stats stats-vertical md:stats-horizontal bg-base-200/50 mt-4 rounded-lg">
              <div class="stat">
                <div class="stat-title text-xs">Avg Malicious/hr</div>
                <div class="stat-value text-error text-2xl" id="tl-statAvg">—</div>
              </div>
              <div class="stat">
                <div class="stat-title text-xs">Peak Malicious</div>
                <div class="stat-value text-warning text-2xl" id="tl-statPeak">—</div>
              </div>
              <div class="stat">
                <div class="stat-title text-xs">Total Events 24H</div>
                <div class="stat-value text-info text-2xl" id="tl-statTotal">—</div>
              </div>
            </div>
            <script dangerouslySetInnerHTML={{ __html: `
(function(){
  function drawChart(){
    var canvas = document.getElementById('threatTimelineChart');
    if(!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    if(!rect.width || !rect.height) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    var W = rect.width, H = rect.height;
    var N = 24;
    function rand(max, base){ return Array.from({length:N}, function(){ return Math.floor(Math.random()*max)+base; }); }
    var series = [
      { label:'Malicious',  color:'#ef4444', fill:'rgba(239,68,68,0.09)',   data: rand(45, 2)  },
      { label:'Suspicious', color:'#f59e0b', fill:'rgba(245,158,11,0.09)',  data: rand(35, 8)  },
      { label:'Blocked',    color:'#22c55e', fill:'rgba(34,197,94,0.09)',   data: rand(65, 15) }
    ];
    var allVals = series.reduce(function(a,s){ return a.concat(s.data); }, []);
    var maxV = Math.max.apply(null, allVals) || 1;
    var pT=24, pB=36, pL=40, pR=16;
    var cW=W-pL-pR, cH=H-pT-pB;
    ctx.strokeStyle = 'rgba(128,128,128,0.15)';
    ctx.lineWidth = 1;
    for(var g=0;g<=4;g++){
      var gy = pT + (cH/4)*g;
      ctx.beginPath(); ctx.moveTo(pL,gy); ctx.lineTo(pL+cW,gy); ctx.stroke();
      ctx.fillStyle = 'rgba(128,128,128,0.6)';
      ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxV - (maxV/4)*g), pL-4, gy+3);
    }
    ctx.fillStyle = 'rgba(128,128,128,0.6)';
    ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    [0,4,8,12,16,20,23].forEach(function(i){
      var x = pL + (cW/(N-1))*i;
      ctx.fillText((i<10?'0':'')+i+':00', x, H-6);
    });
    series.forEach(function(s){
      ctx.beginPath();
      s.data.forEach(function(val,i){ var x=pL+(cW/(N-1))*i, y=pT+cH-(val/maxV)*cH; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
      ctx.lineTo(pL+cW, pT+cH); ctx.lineTo(pL, pT+cH); ctx.closePath();
      ctx.fillStyle = s.fill; ctx.fill();
      ctx.beginPath();
      s.data.forEach(function(val,i){ var x=pL+(cW/(N-1))*i, y=pT+cH-(val/maxV)*cH; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    });
    series.forEach(function(s,i){
      var lx = pL + i*95, ly = pT+2;
      ctx.fillStyle = s.color; ctx.fillRect(lx, ly, 14, 3);
      ctx.fillStyle = 'rgba(128,128,128,0.8)';
      ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(s.label, lx+18, ly+4);
    });
    var malData = series[0].data;
    var avg = Math.round(malData.reduce(function(a,b){return a+b;},0)/malData.length);
    var peak = Math.max.apply(null, malData);
    var total = allVals.reduce(function(a,b){return a+b;},0);
    var e1=document.getElementById('tl-statAvg'), e2=document.getElementById('tl-statPeak'), e3=document.getElementById('tl-statTotal');
    if(e1) e1.textContent = avg+'/hr';
    if(e2) e2.textContent = String(peak);
    if(e3) e3.textContent = String(total);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', drawChart); else drawChart();
  window.addEventListener('resize', drawChart);
})();
            ` }} />
          </div>
        </div>

        {/* QUICK ACTION PANEL */}
        <div class="card bg-base-100 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg mb-4">Quick Actions</h2>
            <div class="space-y-2">
              {[
                { icon: '🔍', label: 'Port Scan', color: 'error' },
                { icon: '🛡️', label: 'Vulnerability Scan', color: 'warning' },
                { icon: '📊', label: 'Whois Lookup', color: 'info' },
                { icon: '🧹', label: 'Full Audit', color: 'success' }
              ].map((action) => (
                <button key={action.label} class={`btn btn-${action.color} btn-outline btn-block justify-start`}>
                  <span class="text-lg">{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* VULNERABILITY & SECURITY STATUS */}
      <div class="grid gap-6 grid-cols-1 lg:grid-cols-2 mb-6">
        <div class="card bg-base-100 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="card-title mb-4">Vulnerability Overview</h2>
            <div class="space-y-3">
              {[
                { level: 'Critical', count: 8, color: 'error', width: 'w-full' },
                { level: 'High', count: 24, color: 'warning', width: 'w-5/6' },
                { level: 'Medium', count: 10, color: 'info', width: 'w-4/6' },
                { level: 'Low', count: 5, color: 'success', width: 'w-3/6' }
              ].map((vuln) => (
                <div key={vuln.level} class="space-y-1">
                  <div class="flex justify-between items-center">
                    <span class="font-semibold text-sm">{vuln.level}</span>
                    <span class={`badge badge-${vuln.color}`}>{vuln.count} issues</span>
                  </div>
                  <progress class={`progress progress-${vuln.color} w-full`} value={vuln.count * 12.5} max="100"></progress>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="card-title mb-4">Security Systems</h2>
            <div class="space-y-2">
              {[
                { name: 'Firewall', status: 'Protected', color: 'success', uptime: '100%' },
                { name: 'IDS/IPS', status: 'Active', color: 'success', uptime: '99.9%' },
                { name: 'WAF', status: 'Updating', color: 'warning', uptime: '98.5%' },
                { name: 'SSL/TLS', status: 'Secure', color: 'success', uptime: '100%' }
              ].map((sys) => (
                <div key={sys.name} class="flex items-center justify-between p-3 bg-base-200/50 rounded-lg hover:bg-base-200 transition-colors">
                  <div class="flex items-center gap-3">
                    <span class={`status status-md status-${sys.color}`}></span>
                    <div>
                      <p class="font-semibold text-sm">{sys.name}</p>
                      <p class="text-xs opacity-60">Uptime: {sys.uptime}</p>
                    </div>
                  </div>
                  <span class={`badge badge-${sys.color} badge-sm`}>{sys.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* THREAT INTELLIGENCE TABLE */}
      <div class="card bg-base-100 shadow-md border border-base-300">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h2 class="card-title">Recent Threats</h2>
              <p class="text-sm opacity-60">Live threat intelligence feed</p>
            </div>
            <button class="btn btn-sm btn-outline">🔄 Refresh</button>
          </div>

          <div class="overflow-x-auto">
            <table class="table table-zebra w-full table-sm">
              <thead class="bg-base-200">
                <tr>
                  <th class="font-bold">Threat ID</th>
                  <th class="font-bold">Source IP</th>
                  <th class="font-bold">Type</th>
                  <th class="font-bold">Severity</th>
                  <th class="font-bold">Status</th>
                  <th class="font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: '#THR-2401', source: '192.168.1.105', type: 'Malware', severity: 'Critical', status: 'Quarantined', icon: '🔒' },
                  { id: '#THR-2402', source: '10.0.0.42', type: 'Phishing', severity: 'High', status: 'Blocked', icon: '🚫' },
                  { id: '#THR-2403', source: '172.16.0.8', type: 'DDoS', severity: 'Critical', status: 'Mitigating', icon: '⚔️' },
                  { id: '#THR-2404', source: '203.0.113.45', type: 'Reconnaissance', severity: 'Medium', status: 'Monitored', icon: '👁️' },
                  { id: '#THR-2405', source: '198.51.100.12', type: 'Exploit', severity: 'High', status: 'Patched', icon: '✓' },
                ].map((threat) => (
                  <tr key={threat.id} class="hover:bg-base-200 transition-colors">
                    <td><span class="font-mono font-bold text-primary">{threat.id}</span></td>
                    <td><code class="bg-base-200 px-2 py-1 rounded text-xs">{threat.source}</code></td>
                    <td><span class="font-semibold">{threat.type}</span></td>
                    <td>
                      <span class={`badge badge-${threat.severity === 'Critical' ? 'error' : threat.severity === 'High' ? 'warning' : 'info'}`}>
                        {threat.severity}
                      </span>
                    </td>
                    <td>
                      <span class="flex items-center gap-1">
                        <span>{threat.icon}</span>
                        <span class="text-sm">{threat.status}</span>
                      </span>
                    </td>
                    <td><button class="btn btn-ghost btn-xs hover:btn-primary">Details →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div class="divider my-2"></div>
          <div class="flex justify-between items-center">
            <span class="text-sm opacity-70">Showing 5 of 847 threats</span>
            <div class="join">
              <button class="join-item btn btn-xs btn-outline">«</button>
              <button class="join-item btn btn-xs btn-active">1</button>
              <button class="join-item btn btn-xs btn-outline">2</button>
              <button class="join-item btn btn-xs btn-outline">3</button>
              <button class="join-item btn btn-xs btn-outline">»</button>
            </div>
          </div>
        </div>
      </div>

      {/* INTEL FEEDS & DOMAINS */}
      <div class="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <div class="card bg-base-100 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="card-title mb-4">Active Intelligence Feeds</h2>
            <div class="space-y-3">
              {[
                { feed: 'MISP Feed', status: 'Active', time: '2 mins ago', updates: 142 },
                { feed: 'URLhaus', status: 'Active', time: '5 mins ago', updates: 87 },
                { feed: 'Abuse.ch', status: 'Active', time: '8 mins ago', updates: 23 },
                { feed: 'Custom Feed', status: 'Active', time: '1 hour ago', updates: 5 }
              ].map((feed) => (
                <div key={feed.feed} class="flex items-center justify-between p-3 bg-base-200/30 rounded-lg hover:bg-base-200 transition-colors group cursor-pointer">
                  <div class="flex items-center gap-3">
                    <span class="status status-md status-success"></span>
                    <div>
                      <p class="font-semibold text-sm">{feed.feed}</p>
                      <p class="text-xs opacity-60">Last update: {feed.time}</p>
                    </div>
                  </div>
                  <span class="badge badge-success badge-sm group-hover:badge-lg transition-all">{feed.updates}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="card-title mb-4">Monitored Malicious Domains</h2>
            <div class="space-y-3">
              {[
                { domain: 'malicious-site.ru', risk: 'High', lastSeen: '1 min ago', badge: 'warning' },
                { domain: 'phishing-portal.net', risk: 'Critical', lastSeen: '5 mins ago', badge: 'error' },
                { domain: 'c2-server.xyz', risk: 'Critical', lastSeen: '12 mins ago', badge: 'error' },
                { domain: 'suspicious-domain.com', risk: 'Medium', lastSeen: '1 hour ago', badge: 'info' }
              ].map((item) => (
                <div key={item.domain} class="flex items-center justify-between p-3 bg-base-200/30 rounded-lg hover:bg-base-200 transition-colors group cursor-pointer">
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <span class={`badge badge-${item.badge} badge-lg`}>▼</span>
                    <div class="flex-1 min-w-0">
                      <p class="font-mono text-sm truncate">{item.domain}</p>
                      <p class="text-xs opacity-60">Seen: {item.lastSeen}</p>
                    </div>
                  </div>
                  <span class={`badge badge-${item.badge} badge-outline badge-sm whitespace-nowrap ml-2`}>{item.risk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
  )
})

export default dashboardMock
