import { Hono } from 'hono'

const landing = new Hono()

landing.get('/', (c) => {
  const year = new Date().getFullYear()
  return c.html(landingPage(year))
})

function landingPage(year: number): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dim">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KOMCAD — Command of Cyber &amp; Active Defense</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='white'/><text y='.9em' font-size='90' fill='black'>&#x25C6;</text></svg>" />
  <link rel="stylesheet" href="/src/style.css" />
  <style>
    @keyframes pulse-slow { 0%,100%{opacity:.8;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
    @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
    @keyframes fadeInUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
    @keyframes gradient-shift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
    .animate-pulse-slow  { animation: pulse-slow 3s ease-in-out infinite; }
    .animate-float       { animation: float 4s ease-in-out infinite; }
    .animate-fadein-1    { animation: fadeInUp .7s ease both; }
    .animate-fadein-2    { animation: fadeInUp .7s .15s ease both; }
    .animate-fadein-3    { animation: fadeInUp .7s .3s ease both; }
    .animate-fadein-4    { animation: fadeInUp .7s .45s ease both; }
    .hero-gradient {
      background: linear-gradient(135deg, oklch(18% .04 260) 0%, oklch(22% .06 280) 50%, oklch(18% .04 240) 100%);
      background-size: 200% 200%;
      animation: gradient-shift 8s ease infinite;
    }
    .grid-dots {
      background-image: radial-gradient(circle, oklch(60% .1 260 / .12) 1px, transparent 1px);
      background-size: 28px 28px;
    }
    .feature-card:hover { transform: translateY(-4px); }
    .feature-card       { transition: transform .25s ease, box-shadow .25s ease; }
    .glow-primary { box-shadow: 0 0 32px oklch(65% .25 280 / .25), 0 0 8px oklch(65% .25 280 / .12); }
    .glow-ring    { box-shadow: 0 0 0 1px oklch(65% .25 280 / .3), 0 0 24px oklch(65% .25 280 / .15); }
  </style>
</head>
<body class="min-h-screen">

  <!-- ── NAVBAR ──────────────────────────────────────────────── -->
  <nav class="navbar bg-base-100/80 backdrop-blur-md border-b border-base-300/50 sticky top-0 z-50 min-h-14 px-4">
    <div class="flex-1">
      <a href="/" class="flex items-center gap-2 group">
        <div class="badge badge-primary badge-sm font-bold text-base group-hover:badge-secondary transition-all">◆</div>
        <span class="font-extrabold text-lg tracking-tight text-primary">KOMCAD</span>
        <span class="hidden sm:inline text-xs opacity-40 font-medium ml-1">Cyber &amp; Active Defense</span>
      </a>
    </div>
    <div class="flex items-center gap-2">
      <!-- Theme selector -->
      <div class="dropdown dropdown-end">
        <button tabindex="0" class="btn btn-ghost btn-sm btn-circle tooltip tooltip-left" data-tip="Theme">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        </button>
        <ul tabindex="0" class="dropdown-content menu shadow-2xl bg-base-100 border border-base-300 rounded-box w-48 max-h-72 overflow-y-auto p-2 gap-0.5 z-50">
          ${['light','dark','cupcake','bumblebee','emerald','corporate','synthwave',
             'retro','cyberpunk','valentine','halloween','garden','forest','aqua',
             'lofi','pastel','fantasy','wireframe','black','luxury','dracula','cmyk',
             'autumn','business','acid','lemonade','night','coffee','winter','dim',
             'nord','sunset','caramellatte','abyss','silk']
            .map(t => `<li><input type="radio" name="theme-landing" class="theme-controller btn btn-xs btn-ghost justify-start" value="${t}" aria-label="${t.charAt(0).toUpperCase()+t.slice(1)}"${t==='dim'?' checked':''}/></li>`)
            .join('')}
        </ul>
      </div>
      <a href="/login" class="btn btn-primary btn-sm gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Launch App
      </a>
    </div>
  </nav>

  <!-- ── HERO ───────────────────────────────────────────────── -->
  <section class="hero-gradient grid-dots relative overflow-hidden min-h-[92vh] flex items-center">
    <!-- Decorative orbs -->
    <div class="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl pointer-events-none"></div>
    <div class="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-secondary/5 blur-3xl pointer-events-none"></div>

    <div class="container mx-auto px-4 py-20 text-center relative z-10 max-w-5xl">

      <!-- Badge -->
      <div class="animate-fadein-1 mb-6 flex justify-center">
        <div class="badge badge-outline badge-primary gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-widest animate-pulse-slow">
          <span class="status status-primary status-xs"></span>
          Cyber Intelligence Platform — Active
        </div>
      </div>

      <!-- Title -->
      <h1 class="animate-fadein-2 text-5xl sm:text-6xl md:text-7xl font-black leading-[1.1] tracking-tight mb-6">
        <span class="text-base-content">Command of</span><br/>
        <span class="bg-linear-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          Cyber &amp; Active Defense
        </span>
      </h1>

      <!-- Subtitle -->
      <p class="animate-fadein-3 text-base sm:text-lg md:text-xl text-base-content/60 max-w-2xl mx-auto mb-10 leading-relaxed">
        A unified operator console for threat intelligence, security monitoring, and active cyber defense — 
        built for speed, precision, and operational clarity.
      </p>

      <!-- CTA buttons -->
      <div class="animate-fadein-4 flex flex-col sm:flex-row gap-3 justify-center items-center">
        <a href="/login" class="btn btn-primary btn-lg gap-2 glow-primary min-w-44">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          Launch App
        </a>
        <button onclick="document.getElementById('contact_modal').showModal()" class="btn btn-outline btn-lg gap-2 min-w-44">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
          Contact Me
        </button>
      </div>

      <!-- Decorative terminal preview -->
      <div class="mt-16 animate-float max-w-2xl mx-auto">
        <div class="mockup-browser border border-base-300/50 bg-base-100/60 backdrop-blur-sm shadow-2xl glow-ring text-left">
          <div class="mockup-browser-toolbar">
            <div class="input bg-base-200/80 text-xs opacity-60">komcad.internal / intelligence</div>
          </div>
          <div class="bg-base-200/40 px-6 py-5 space-y-2 font-mono text-xs">
            <div class="flex gap-3"><span class="text-success font-bold">✓</span><span class="text-base-content/70">AbuseIPDB    <span class="text-success">CLEAN</span>    score: 0/100</span></div>
            <div class="flex gap-3"><span class="text-success font-bold">✓</span><span class="text-base-content/70">VirusTotal   <span class="text-warning">2/72</span>     detections</span></div>
            <div class="flex gap-3"><span class="text-error font-bold">!</span><span class="text-base-content/70">OTX          <span class="text-error">MALICIOUS</span> 4 pulses</span></div>
            <div class="flex gap-3"><span class="text-primary font-bold">→</span><span class="text-primary">Verdict: <span class="badge badge-error badge-xs font-bold">HIGH RISK</span> — recommend block</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── FEATURES ───────────────────────────────────────────── -->
  <section id="features" class="py-24 bg-base-100">
    <div class="container mx-auto px-4 max-w-6xl">
      <div class="text-center mb-16">
        <div class="badge badge-primary badge-outline mb-4 px-4 py-2 text-xs uppercase tracking-wider">Capabilities</div>
        <h2 class="text-3xl md:text-4xl font-black mb-4">What KOMCAD Can Do</h2>
        <p class="text-base-content/50 max-w-xl mx-auto">Every feature engineered for operational efficiency — from real-time threat feeds to deep indicator enrichment.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

        <!-- Feature cards -->
        ${[
          {
            icon: '🔍',
            title: 'Threat Intelligence',
            color: 'primary',
            desc: 'Correlate IPs, domains, URLs, and file hashes against AbuseIPDB, VirusTotal, OTX AlienVault, and ThreatFox simultaneously.',
            tags: ['AbuseIPDB', 'VirusTotal', 'OTX', 'ThreatFox'],
          },
          {
            icon: '📰',
            title: 'Cyber News Hub',
            color: 'secondary',
            desc: 'Single-pane-of-glass aggregation from top security sources: The Hacker News, BleepingComputer, SANS ISC, Krebs on Security, and Dark Reading.',
            tags: ['RSS Feeds', 'Real-time', 'Multi-source'],
          },
          {
            icon: '🌐',
            title: 'Bulk WHOIS / GeoIP',
            color: 'accent',
            desc: 'Batch IP enrichment powered by IPInfo — country, city, ASN, organisation, and hosting provider for entire address lists.',
            tags: ['IPInfo', 'Geo', 'ASN', 'Org'],
          },
          {
            icon: '🛡️',
            title: 'Multi-Layer Auth',
            color: 'success',
            desc: 'JWT-based session security with brute-force rate limiting, audit trail logging, and configurable admin/demo account separation.',
            tags: ['JWT', 'Rate Limit', 'Audit Log'],
          },
          {
            icon: '⚡',
            title: 'HTMX-Powered UX',
            color: 'warning',
            desc: 'Seamless partial-page navigation — no full reloads. Every action is instant, keeping operators in the flow without disruption.',
            tags: ['HTMX', 'SPA-like', 'Fast'],
          },
          {
            icon: '☁️',
            title: 'Edge-Native Deploy',
            color: 'info',
            desc: 'Built on Hono + Cloudflare Workers for sub-100 ms global response. No server maintenance, no cold starts, no infrastructure ops.',
            tags: ['Cloudflare', 'Workers', 'Global CDN'],
          },
        ].map(f => `
        <div class="card bg-base-200 border border-base-300 feature-card hover:border-${f.color}/40 hover:shadow-xl hover:shadow-${f.color}/5">
          <div class="card-body gap-3 p-5">
            <div class="text-3xl">${f.icon}</div>
            <h3 class="font-bold text-base">${f.title}</h3>
            <p class="text-sm text-base-content/60 leading-relaxed">${f.desc}</p>
            <div class="flex flex-wrap gap-1.5 mt-1">
              ${f.tags.map(t => `<span class="badge badge-${f.color} badge-soft badge-xs font-medium">${t}</span>`).join('')}
            </div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <!-- ── HOW IT WORKS ───────────────────────────────────────── -->
  <section class="py-24 bg-base-200">
    <div class="container mx-auto px-4 max-w-4xl">
      <div class="text-center mb-16">
        <div class="badge badge-secondary badge-outline mb-4 px-4 py-2 text-xs uppercase tracking-wider">Workflow</div>
        <h2 class="text-3xl md:text-4xl font-black mb-4">From Indicator to Decision</h2>
        <p class="text-base-content/50 max-w-xl mx-auto">KOMCAD compresses a multi-tool research workflow into a single, streamlined operator experience.</p>
      </div>
      <ul class="timeline timeline-vertical">
        ${[
          { step: '01', title: 'Authenticate', desc: 'Secure JWT login with rate-limiting and full audit trail — know who accessed what and when.', color: 'step-primary' },
          { step: '02', title: 'Ingest Indicators', desc: 'Paste a raw list of IPs, domains, URLs, or hashes. KOMCAD handles bulk input automatically.', color: 'step-secondary' },
          { step: '03', title: 'Cross-Source Enrichment', desc: 'Parallel queries to AbuseIPDB, VirusTotal, OTX, and ThreatFox — results merged in seconds.', color: 'step-accent' },
          { step: '04', title: 'Contextual Analysis', desc: 'Combined Analysis mode produces a unified verdict, risk score, and source-by-source breakdown.', color: 'step-success' },
          { step: '05', title: 'Act', desc: 'Export findings, share reports, or feed results directly into your blocking and response pipeline.', color: 'step-warning' },
        ].map((s, i, arr) => `
        <li>
          ${i > 0 ? '<hr/>' : ''}
          <div class="timeline-start text-right hidden sm:block">
            <span class="text-xs font-mono opacity-40">${s.step}</span>
          </div>
          <div class="timeline-middle">
            <div class="w-8 h-8 rounded-full bg-base-100 border-2 border-primary flex items-center justify-center text-xs font-bold text-primary">${s.step}</div>
          </div>
          <div class="timeline-end timeline-box bg-base-100 border border-base-300 mb-6">
            <h3 class="font-bold text-sm mb-1">${s.title}</h3>
            <p class="text-xs text-base-content/60 leading-relaxed">${s.desc}</p>
          </div>
          ${i < arr.length - 1 ? '<hr/>' : ''}
        </li>`).join('')}
      </ul>
    </div>
  </section>

  <!-- ── STATS ─────────────────────────────────────────────── -->
  <section class="py-20 bg-base-100">
    <div class="container mx-auto px-4 max-w-5xl">
      <div class="stats stats-vertical sm:stats-horizontal w-full shadow bg-base-200 border border-base-300">
        ${[
          { title: 'Data Sources', value: '4+', desc: 'AbuseIPDB · VirusTotal · OTX · ThreatFox', icon: '🔗' },
          { title: 'News Sources', value: '5', desc: 'THN · Bleeping · SANS · Krebs · DarkReading', icon: '📡' },
          { title: 'Deploy Regions', value: '300+', desc: 'Cloudflare global edge network', icon: '🌍' },
          { title: 'Auth Security', value: 'JWT', desc: '8h sessions · rate-limited · audited', icon: '🔐' },
        ].map(s => `
        <div class="stat">
          <div class="stat-figure text-2xl">${s.icon}</div>
          <div class="stat-title text-xs">${s.title}</div>
          <div class="stat-value text-primary text-2xl font-black">${s.value}</div>
          <div class="stat-desc text-xs opacity-60">${s.desc}</div>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <!-- ── ROADMAP ────────────────────────────────────────────── -->
  <section id="roadmap" class="py-24 bg-base-200">
    <div class="container mx-auto px-4 max-w-5xl">
      <div class="text-center mb-16">
        <div class="badge badge-accent badge-outline mb-4 px-4 py-2 text-xs uppercase tracking-wider">Roadmap</div>
        <h2 class="text-3xl md:text-4xl font-black mb-4">What's Coming Next</h2>
        <p class="text-base-content/50 max-w-xl mx-auto">KOMCAD is a living platform. These capabilities are in active development.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${[
          { icon: '🔎', title: 'NMAP / RustScan Integration', desc: 'Trigger live network scans from the browser — surface open ports and service banners directly in the console.', status: 'In Development' },
          { icon: '📡', title: 'HTTP Proxy & Interception', desc: 'Built-in web proxy for manual traffic inspection, request replay, and in-flight header manipulation.', status: 'Planned' },
          { icon: '🧩', title: 'MISP Integration', desc: 'Push and pull threat intelligence from your MISP instance — events, attributes, and IOC sharing in both directions.', status: 'Planned' },
          { icon: '📋', title: 'Report Utility', desc: 'Auto-generate structured PDF/HTML incident reports from intelligence findings — ready for leadership briefings.', status: 'In Development' },
          { icon: '⚕️', title: 'Platform Health Monitor', desc: 'Real-time service health dashboard: API key quotas, upstream source availability, and latency metrics.', status: 'Planned' },
          { icon: '⚙️', title: 'Configuration Interface', desc: 'UI-driven management for API keys, user accounts, SMTP settings, and feature toggles — no config file edits required.', status: 'Planned' },
        ].map(r => `
        <div class="card bg-base-100 border border-base-300 feature-card hover:border-accent/30">
          <div class="card-body p-4 flex-row gap-4 items-start">
            <div class="text-2xl shrink-0 mt-0.5">${r.icon}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <h3 class="font-bold text-sm">${r.title}</h3>
                <span class="badge badge-xs ${r.status === 'In Development' ? 'badge-warning' : 'badge-ghost'} shrink-0">${r.status}</span>
              </div>
              <p class="text-xs text-base-content/55 leading-relaxed">${r.desc}</p>
            </div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <!-- ── FINAL CTA ──────────────────────────────────────────── -->
  <section class="py-24 bg-base-100">
    <div class="container mx-auto px-4 text-center max-w-2xl">
      <div class="text-5xl mb-6 animate-float inline-block">◆</div>
      <h2 class="text-3xl md:text-4xl font-black mb-4">Ready to Operate?</h2>
      <p class="text-base-content/50 mb-10 text-lg">Access KOMCAD's full capability suite — authenticate and get to work.</p>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <a href="/login" class="btn btn-primary btn-lg gap-2 glow-primary min-w-44">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          Launch App
        </a>
        <button onclick="document.getElementById('contact_modal').showModal()" class="btn btn-outline btn-lg gap-2 min-w-44">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
          Contact Me
        </button>
      </div>
    </div>
  </section>

  <!-- ── FOOTER ─────────────────────────────────────────────── -->
  <footer class="footer footer-center bg-base-200 border-t border-base-300 p-8 text-base-content/50">
    <div class="flex items-center gap-2 mb-2">
      <div class="badge badge-primary badge-sm">◆</div>
      <span class="font-bold text-primary">KOMCAD</span>
    </div>
    <p class="text-xs">© ${year} KOMCAD — Command of Cyber &amp; Active Defense</p>
    <p class="text-xs opacity-50">Built on Hono · Cloudflare Workers · daisyUI</p>
  </footer>

  <!-- ── CONTACT MODAL ──────────────────────────────────────── -->
  <dialog id="contact_modal" class="modal">
    <div class="modal-box w-full max-w-lg">
      <h3 class="font-bold text-lg mb-1">📬 Contact Me</h3>
      <p class="text-sm text-base-content/60 mb-4">Send a message directly to the KOMCAD administrator.</p>
      <form id="contactForm" novalidate>
        <div class="space-y-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Your Name</legend>
            <input type="text" name="name" id="contactName" class="input input-bordered w-full input-sm" placeholder="Full name" required />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Email Address</legend>
            <input type="email" name="email" id="contactEmail" class="input input-bordered w-full input-sm" placeholder="your@email.com" required />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Message</legend>
            <textarea name="message" id="contactMessage" class="textarea textarea-bordered w-full h-28 resize-none text-sm" placeholder="Your message…" required></textarea>
          </fieldset>
        </div>
        <div id="contactStatus" class="mt-3 hidden"></div>
        <div class="modal-action mt-4">
          <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('contact_modal').close()">Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm" id="contactSubmitBtn">Send Message</button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
  </dialog>

  <script>
  (function () {
    // Contact form
    document.addEventListener('submit', function (e) {
      if (!e.target || e.target.id !== 'contactForm') return
      e.preventDefault()
      var form   = e.target
      var btn    = document.getElementById('contactSubmitBtn')
      var status = document.getElementById('contactStatus')
      var name    = document.getElementById('contactName').value.trim()
      var email   = document.getElementById('contactEmail').value.trim()
      var message = document.getElementById('contactMessage').value.trim()
      if (!name || !email || !message) {
        status.className = 'mt-3 alert alert-warning alert-soft text-sm'
        status.textContent = 'Please fill in all fields.'
        return
      }
      btn.disabled = true
      btn.textContent = 'Sending…'
      status.className = 'mt-3 hidden'
      var fd = new FormData(form)
      fetch('/api/contact', { method: 'POST', body: fd })
        .then(function (r) { return r.json() })
        .then(function (res) {
          if (res.success) {
            status.className = 'mt-3 alert alert-success alert-soft text-sm'
            status.textContent = res.message || 'Message sent!'
            form.reset()
            setTimeout(function () {
              document.getElementById('contact_modal').close()
              status.className = 'mt-3 hidden'
            }, 2200)
          } else {
            status.className = 'mt-3 alert alert-error alert-soft text-sm'
            status.textContent = res.message || 'Failed to send.'
          }
        })
        .catch(function (err) {
          status.className = 'mt-3 alert alert-error alert-soft text-sm'
          status.textContent = 'Network error: ' + err.message
        })
        .finally(function () {
          btn.disabled = false
          btn.textContent = 'Send Message'
        })
    })
  })()
  </script>
</body>
</html>`
}

export default landing
