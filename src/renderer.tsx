import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children, title }: any, c: any) => {
  // Extract authenticated username (set by JWT middleware)
  const username: string = ((c as any).get?.('username') as string) || 'User'
  const initials = username.slice(0, 2).toUpperCase()
  const isAdmin = username !== 'User' && username === (process.env.ADMIN_USER ?? 'administrator')
  // HTMX partial navigation: return only content + OOB breadcrumb swap
  if (c.req.header('HX-Request')) {
    c.header('HX-Title', title ?? 'News Hub')
    return (
      <>
        {/* OOB-swap breadcrumb so it stays in sync without full reload */}
        <span
          id="breadcrumb-current"
          {...{ 'hx-swap-oob': 'true' }}
          class="text-primary font-semibold"
        >
          {title ?? 'News Hub'}
        </span>
        {children}
      </>
    )
  }

  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <title>{title ?? 'KOMCAD'}</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='white'/><text y='.9em' font-size='90' fill='black'>&#x25C6;</text></svg>" />
        <link rel="stylesheet" href="/src/style.css" />
        <script src="https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js" />
      </head>

      <body class="bg-base-200">

        <div class="drawer" id="app-drawer">

          <input id="sidebar" type="checkbox" class="drawer-toggle" />

          {/* ── PAGE CONTENT ── */}
          <div class="drawer-content flex flex-col">

            {/* NAVBAR */}
            <div class="navbar bg-base-100 border-b border-base-300 shadow-md sticky top-0 z-40 min-h-12 py-1">

              {/* Breadcrumb with integrated hamburger */}
              <div class="flex-1 px-2 lg:px-4">
                <div class="breadcrumbs text-sm">
                  <ul>
                    <li>
                      <button id="hamburgerBtn" class="btn btn-square btn-ghost btn-sm" title="Toggle sidebar">☰</button>
                    </li>
                    <li>
                      <a
                        {...{ 'hx-get': '/', 'hx-target': '#page-content', 'hx-push-url': 'true', 'hx-swap': 'innerHTML' }}
                        class="link link-hover"
                      >
                        Home
                      </a>
                    </li>
                    <li>
                      <span id="breadcrumb-current" class="text-primary font-semibold">
                        {title ?? 'News Hub'}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <div class="flex items-center gap-2">


                {/* Alerts bell — non-interactive (not configured) */}
                <div
                  class="btn btn-ghost btn-circle btn-sm indicator cursor-not-allowed opacity-60 tooltip tooltip-left"
                  data-tip="Alerts (3 new)"
                  tabindex={-1}
                  aria-disabled="true"
                >
                  <span class="indicator-item badge badge-error badge-xs font-bold">3</span>
                  🔔
                </div>

                {/* Theme toggle */}
                <div class="dropdown dropdown-end">
                  <button class="btn btn-ghost btn-circle btn-sm tooltip tooltip-left" data-tip="Theme">
                    🎨
                  </button>
                  <ul class="dropdown-content menu shadow-lg bg-base-100 rounded-box w-52 max-h-80 overflow-y-auto p-2 gap-1">
                    {[
                      'light','dark','cupcake','bumblebee','emerald','corporate','synthwave',
                      'retro','cyberpunk','valentine','halloween','garden','forest','aqua',
                      'lofi','pastel','fantasy','wireframe','black','luxury','dracula','cmyk',
                      'autumn','business','acid','lemonade','night','coffee','winter','dim',
                      'nord','sunset','caramellatte','abyss','silk',
                    ].map((t) => (
                      <li key={t}>
                        <input
                          type="radio"
                          name="theme"
                          class="theme-controller btn btn-xs btn-outline justify-start"
                          value={t}
                          aria-label={t.charAt(0).toUpperCase() + t.slice(1)}
                          {...(t === 'dim' ? { checked: true } : {})}
                        />
                      </li>
                    ))}
                  </ul>
                </div>

                {/* User menu */}
                <div class="dropdown dropdown-end">
                  <button
                    class="btn btn-ghost btn-circle btn-sm avatar tooltip tooltip-left"
                    data-tip={username}
                    tabindex={0}
                  >
                    <div class="w-8 rounded-full bg-gradient-to-br from-primary to-secondary text-primary-content flex items-center justify-center font-bold text-sm">
                      {initials}
                    </div>
                  </button>
                  <ul tabindex={0} class="dropdown-content menu shadow-lg bg-base-100 border border-base-300 rounded-box w-44 p-2 gap-0.5 z-50">
                    <li class="px-3 py-1.5">
                      <span class="text-xs font-bold opacity-70 select-none">{username}</span>
                    </li>
                    <div class="divider my-0.5"></div>
                    <li>
                      <a href="/logout" class="text-error hover:bg-error/10 text-sm">
                        🚪 Logout
                      </a>
                    </li>
                  </ul>
                </div>

              </div>
            </div>

            {/* MAIN CONTENT */}
            <main id="page-content" class="p-4 md:p-6 flex-1">
              {children}
            </main>

            {/* FOOTER */}
            <footer class="footer footer-center bg-base-100 border-t border-base-300 p-3 text-base-content/70">
              <div class="text-xs">
                <p>© 2026 KOMCAD — Command of Cyber &amp; Active Defense</p>
              </div>
            </footer>

          </div>

          {/* ── SIDEBAR ── */}
          <div class="drawer-side">
            <label for="sidebar" class="drawer-overlay"></label>

            <aside class="w-60 bg-base-100 border-r border-base-300 flex flex-col h-screen">

              {/* Sidebar header */}
              <div class="p-3 border-b border-base-300 shrink-0">
                <div class="flex items-center gap-2">
                  <div class="badge badge-primary badge-sm">◆</div>
                  <div>
                    <div class="font-bold text-primary text-sm leading-tight">KOMCAD</div>
                    <div class="text-xs opacity-50 leading-tight">Command of Cyber &amp; Active Defense</div>
                  </div>
                </div>
              </div>

              {/* Sidebar menu — scrollable */}
              <div class="flex-1 overflow-y-auto">
                <ul class="menu w-full px-2 py-2 gap-0.5 text-sm">

                  {/* News Hub — main page */}
                  <li>
                    <a
                      {...{ 'hx-get': '/', 'hx-target': '#page-content', 'hx-push-url': 'true', 'hx-swap': 'innerHTML' }}
                      class="py-1.5 hover:bg-primary/20 nav-link gap-2"
                      data-path="/"
                    >
                      <span>📰</span>
                      <span>News Hub</span>
                    </a>
                  </li>

                  {/* Intelligence */}
                  <li>
                    <a
                      {...{ 'hx-get': '/intelligence', 'hx-target': '#page-content', 'hx-push-url': 'true', 'hx-swap': 'innerHTML' }}
                      class="py-1.5 hover:bg-primary/20 nav-link gap-2"
                      data-path="/intelligence"
                    >
                      <span>🔍</span>
                      <span>Intelligence</span>
                    </a>
                  </li>

                  {/* Bulk Whois — enabled */}
                  <li>
                    <a
                      {...{ 'hx-get': '/whois', 'hx-target': '#page-content', 'hx-push-url': 'true', 'hx-swap': 'innerHTML' }}
                      class="py-1.5 hover:bg-primary/20 nav-link gap-2"
                      data-path="/whois"
                    >
                      <span>🌐</span>
                      <span>Bulk Whois</span>
                    </a>
                  </li>

                  <div class="divider my-1 text-xs font-bold">Coming Soon</div>

                  {/* Disabled items */}
                  {[
                    { icon: '🔎', label: 'NMAP / RustScan' },
                    { icon: '📡', label: 'HTTP Proxy' },
                    { icon: '🧩', label: 'MISP' },
                    { icon: '📋', label: 'Report Utility' },
                    { icon: '⚕️', label: 'Health' },
                    { icon: '⚙️', label: 'Configuration' },
                  ].map((item) => (
                    <li key={item.label} class="opacity-40 pointer-events-none select-none">
                      <span class="py-1.5 gap-2 cursor-not-allowed">
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </span>
                    </li>
                  ))}

                  {/* Admin section — visible only to admin user */}
                  {isAdmin && (
                    <>
                      <div class="divider my-1 text-xs opacity-40">Admin</div>
                      <li>
                        <a
                          {...{ 'hx-get': '/admin/auditlog', 'hx-target': '#page-content', 'hx-push-url': 'true', 'hx-swap': 'innerHTML' }}
                          class="py-1.5 hover:bg-primary/20 nav-link gap-2"
                          data-path="/admin/auditlog"
                        >
                          <span>📋</span>
                          <span>Audit Log</span>
                        </a>
                      </li>
                    </>
                  )}

                </ul>
              </div>

              {/* Sidebar footer — only report button */}
              <div class="border-t border-base-300 px-2 py-1.5 shrink-0">
                <button
                  class="btn btn-primary btn-xs w-full"
                  onclick="document.getElementById('report_modal').showModal()"
                >
                  📬 Report Problem / Contact Me
                </button>
              </div>

            </aside>
          </div>

        </div>

        {/* ── REPORT MODAL ── */}
        <dialog id="report_modal" class="modal">
          <div class="modal-box w-full max-w-lg">
            <h3 class="font-bold text-lg mb-1">📬 Report Problem / Contact Me</h3>
            <p class="text-sm text-base-content/60 mb-4">
              Send a message directly to the administrator.
            </p>

            <form id="reportForm" novalidate>
              <div class="space-y-3">
                <fieldset class="fieldset">
                  <legend class="fieldset-legend text-xs">Your Name</legend>
                  <input
                    type="text"
                    name="name"
                    id="reportName"
                    class="input input-bordered w-full input-sm"
                    placeholder="Full name"
                    required
                  />
                </fieldset>

                <fieldset class="fieldset">
                  <legend class="fieldset-legend text-xs">Email Address</legend>
                  <input
                    type="email"
                    name="email"
                    id="reportEmail"
                    class="input input-bordered w-full input-sm"
                    placeholder="your@email.com"
                    required
                  />
                </fieldset>

                <fieldset class="fieldset">
                  <legend class="fieldset-legend text-xs">Message</legend>
                  <textarea
                    name="message"
                    id="reportMessage"
                    class="textarea textarea-bordered w-full h-28 resize-none text-sm"
                    placeholder="Describe the issue or your message..."
                    required
                  />
                </fieldset>
              </div>

              {/* Status area */}
              <div id="reportStatus" class="mt-3 hidden"></div>

              <div class="modal-action mt-4">
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  onclick="document.getElementById('report_modal').close()"
                >
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary btn-sm" id="reportSubmitBtn">
                  Send Message
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" class="modal-backdrop">
            <button>close</button>
          </form>
        </dialog>

        {/* ── SCRIPTS ── */}
        <script dangerouslySetInnerHTML={{ __html: `
(function () {
  // ── Sidebar toggle ────────────────────────────────────────────────────────
  (function () {
    var drawer = document.getElementById('app-drawer');
    var toggle = document.getElementById('sidebar');
    var btn    = document.getElementById('hamburgerBtn');
    if (!drawer || !toggle || !btn) return;
    // Default open on desktop
    if (window.innerWidth >= 1024) {
      drawer.classList.add('drawer-open');
      toggle.checked = true;
    }
    // Hamburger click: toggle
    btn.addEventListener('click', function () {
      var isOpen = drawer.classList.toggle('drawer-open');
      toggle.checked = isOpen;
    });
    // Mobile overlay tap: keep class in sync with checkbox
    toggle.addEventListener('change', function () {
      drawer.classList.toggle('drawer-open', toggle.checked);
    });
  })();

  // ── Active nav link sync ──────────────────────────────────────────────────
  function syncNav() {
    var p = location.pathname.replace(/\\/$/, '') || '/';
    document.querySelectorAll('.nav-link').forEach(function (el) {
      var target = (el.getAttribute('data-path') || '').replace(/\\/$/, '') || '/';
      el.classList.toggle('active', target === p);
    });
  }
  syncNav();
  document.addEventListener('htmx:afterSettle', syncNav);

  // ── Report form submission ────────────────────────────────────────────────
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'reportForm') {
      e.preventDefault();
      var form   = e.target;
      var btn    = document.getElementById('reportSubmitBtn');
      var status = document.getElementById('reportStatus');
      var name    = document.getElementById('reportName').value.trim();
      var email   = document.getElementById('reportEmail').value.trim();
      var message = document.getElementById('reportMessage').value.trim();

      if (!name || !email || !message) {
        status.className = 'mt-3 alert alert-warning alert-soft text-sm';
        status.textContent = 'Please fill in all fields.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Sending…';
      status.className = 'mt-3 hidden';

      var fd = new FormData(form);
      fetch('/api/report', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.success) {
            status.className = 'mt-3 alert alert-success alert-soft text-sm';
            status.textContent = res.message || 'Message sent!';
            form.reset();
            setTimeout(function () {
              document.getElementById('report_modal').close();
              status.className = 'mt-3 hidden';
            }, 2200);
          } else {
            status.className = 'mt-3 alert alert-error alert-soft text-sm';
            status.textContent = res.message || 'Failed to send.';
          }
        })
        .catch(function (err) {
          status.className = 'mt-3 alert alert-error alert-soft text-sm';
          status.textContent = 'Network error: ' + err.message;
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = 'Send Message';
        });
    }
  });
})();
        `}} />

      </body>
    </html>
  )
})
