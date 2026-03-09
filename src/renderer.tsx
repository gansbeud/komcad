import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children, title }: any, c: any) => {
  // For htmx partial navigation: return only the content fragment.
  // The sidebar/navbar stay mounted — no flicker.
  if (c.req.header('HX-Request')) {
    c.header('HX-Title', title ?? 'Dashboard')
    return (
      <>
        {/* OOB-swap the breadcrumb title so it stays in sync */}
        <span
          id="breadcrumb-current"
          {...{ 'hx-swap-oob': 'true' }}
          class="text-primary font-semibold"
        >
          {title ?? 'Overview'}
        </span>
        {children}
      </>
    )
  }

  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <title>{title ?? "Dashboard"}</title>
        <link rel="stylesheet" href="/src/style.css" />
        {/* htmx — enables SPA-like partial navigation without a full page reload */}
        <script src="https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js" />
      </head>

      <body class="bg-base-200">

        <div class="drawer lg:drawer-open">

          <input id="sidebar" type="checkbox" class="drawer-toggle" />

          {/* PAGE CONTENT */}
          <div class="drawer-content flex flex-col">

            {/* NAVBAR */}
            <div class="navbar bg-base-100 border-b border-base-300 shadow-md sticky top-0 z-40">

              <div class="flex-none">
                <label for="sidebar" class="btn btn-square btn-ghost btn-lg">
                  ☰
                </label>
              </div>

              <div class="flex-1 px-4">
                <div class="breadcrumbs text-sm">
                  <ul>
                    <li><a href="/" class="link link-hover">Home</a></li>
                    <li><a href="/" class="link link-hover">News Hub</a></li>
                    <li><span id="breadcrumb-current" class="text-primary font-semibold">{title ?? 'Overview'}</span></li>
                  </ul>
                </div>
              </div>

              <div class="flex items-center gap-3">

                {/* SEARCH BAR */}
                <div class="form-control hidden md:block">
                  <input type="text" placeholder="Search threats, IPs, domains..." class="input input-bordered input-sm w-64 focus:input-primary transition-all" />
                </div>

                {/* SEARCH ICON - MOBILE */}
                <button class="btn btn-ghost btn-circle md:hidden tooltip tooltip-left" data-tip="Search">
                  🔍
                </button>

                {/* NOTIFICATIONS */}
                <div class="dropdown dropdown-end">
                  <button class="btn btn-ghost btn-circle indicator indicator-center tooltip tooltip-left" data-tip="Alerts (3 new)">
                    <span class="indicator-item badge badge-error badge-xs font-bold">3</span>
                    🔔
                  </button>
                  <ul class="dropdown-content menu p-3 shadow bg-base-100 rounded-box w-72 gap-2">
                    <li class="menu-title"><span>Recent Alerts</span></li>
                    <li><a class="hover:bg-error/10">
                      <span class="badge badge-error badge-sm">Critical</span>
                      DDoS attack detected on port 443
                    </a></li>
                    <li><a class="hover:bg-warning/10">
                      <span class="badge badge-warning badge-sm">High</span>
                      Malware signature matched on 3 hosts
                    </a></li>
                    <li><a class="hover:bg-info/10">
                      <span class="badge badge-info badge-sm">Info</span>
                      New vulnerability CVE-2024-1234
                    </a></li>
                  </ul>
                </div>

                {/* THEME TOGGLE */}
                <div class="dropdown dropdown-end">
                  <button class="btn btn-ghost btn-circle tooltip tooltip-left" data-tip="Theme">
                    🎨
                  </button>

                  <ul class="dropdown-content menu shadow-lg bg-base-100 rounded-box w-53 max-h-200 overflow-y-auto p-2 gap-1">
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="light" aria-label="Light"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="dark" aria-label="Dark" checked/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="cupcake" aria-label="Cupcake"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="bumblebee" aria-label="Bumblebee"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="emerald" aria-label="Emerald"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="corporate" aria-label="Corporate"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="synthwave" aria-label="Synthwave"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="retro" aria-label="Retro"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="cyberpunk" aria-label="Cyberpunk"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="valentine" aria-label="Valentine"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="halloween" aria-label="Halloween"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="garden" aria-label="Garden"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="forest" aria-label="Forest"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="aqua" aria-label="Aqua"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="lofi" aria-label="Lo-Fi"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="pastel" aria-label="Pastel"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="fantasy" aria-label="Fantasy"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="wireframe" aria-label="Wireframe"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="black" aria-label="Black"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="luxury" aria-label="Luxury"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="dracula" aria-label="Dracula"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="cmyk" aria-label="CMYK"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="autumn" aria-label="Autumn"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="business" aria-label="Business"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="acid" aria-label="Acid"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="lemonade" aria-label="Lemonade"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="night" aria-label="Night"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="coffee" aria-label="Coffee"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="winter" aria-label="Winter"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="dim" aria-label="Dim"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="nord" aria-label="Nord"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="sunset" aria-label="Sunset"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="caramellatte" aria-label="Caramel Latte"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="abyss" aria-label="Abyss"/></li>
                    <li><input type="radio" name="theme" class="theme-controller btn btn-sm btn-outline justify-start" value="silk" aria-label="Silk"/></li>
                  </ul>
                </div>
                
                {/* USER PROFILE */}
                <div class="dropdown dropdown-end">

                  <div tabindex={0} role="button" class="btn btn-ghost btn-circle avatar tooltip tooltip-left" data-tip="Profile">
                    <div class="w-10 rounded-full bg-linear-to-br from-primary to-secondary text-primary-content flex items-center justify-center font-bold text-lg">
                      AK
                    </div>
                  </div>

                  <ul class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-56 gap-1">
                    <li class="menu-title text-center py-2">
                      <span>Admin Analyst</span>
                    </li>
                    <div class="divider my-0"></div>
                    <li><a class="hover:bg-primary/10">👤 Profile</a></li>
                    <li><a class="hover:bg-info/10">⚙️ Settings</a></li>
                    <li><a class="hover:bg-warning/10">📊 Activity Log</a></li>
                    <div class="divider my-0"></div>
                    <li><a class="text-error hover:bg-error/10">🚪 Logout</a></li>
                  </ul>

                </div>

              </div>
            </div>

            {/* MAIN CONTENT */}
            <main id="page-content" class="p-4 md:p-8 flex-1">
              {children}
            </main>

            {/* FOOTER */}
            <footer class="footer footer-center bg-base-100 border-t border-base-300 p-4 text-base-content/70">
              <div class="text-xs">
                <p>© 2026 Project-K Intelligence | Security Dashboard v2.4</p>
              </div>
            </footer>

          </div>


          {/* SIDEBAR */}
          <div class="drawer-side is-drawer-close:overflow-visible">
            <label for="sidebar" aria-label="close sidebar" class="drawer-overlay"></label>

            <div class="is-drawer-close:w-14 is-drawer-open:w-64 bg-base-100 border-r border-base-300 flex flex-col h-screen overflow-hidden transition-[width] duration-300">

              {/* SIDEBAR HEADER */}
              <div class="p-3 border-b border-base-300 shrink-0">
                <div class="flex items-center gap-2 overflow-hidden">
                  <div class="badge badge-primary badge-md shrink-0">◆</div>
                  <div class="is-drawer-close:hidden whitespace-nowrap">
                    <div class="font-bold text-primary text-sm leading-tight">
                      Project-K
                    </div>
                    <div class="text-xs opacity-50">
                      Cyber Intel
                    </div>
                  </div>
                </div>
              </div>

              {/* SIDEBAR MENU - SCROLLABLE */}
              <div class="flex-1 overflow-y-auto">
                <ul class="menu w-full px-3 py-2 gap-2 text-sm">

                  <li>
                    <a
                      {...{ 'hx-get': '/', 'hx-target': '#page-content', 'hx-push-url': 'true', 'hx-swap': 'innerHTML' }}
                      class="h-12 hover:bg-primary/20 nav-link is-drawer-close:tooltip is-drawer-close:tooltip-right"
                      data-path="/"
                      data-tip="News Hub"
                    >
                      <span class="text-xl">📰</span>
                      <span class="text-base font-semibold is-drawer-close:hidden">News Hub</span>
                    </a>
                  </li>

                  <li>
                    <a
                      {...{ 'hx-get': '/dashboard-mock', 'hx-target': '#page-content', 'hx-push-url': 'true', 'hx-swap': 'innerHTML' }}
                      class="h-12 hover:bg-primary/20 nav-link is-drawer-close:tooltip is-drawer-close:tooltip-right"
                      data-path="/dashboard-mock"
                      data-tip="Dashboard - Mock"
                    >
                      <span class="text-xl">📊</span>
                      <span class="text-base font-semibold is-drawer-close:hidden">Dashboard - Mock</span>
                    </a>
                  </li>

                  <li>
                    <a
                      {...{ 'hx-get': '/intelligence', 'hx-target': '#page-content', 'hx-push-url': 'true', 'hx-swap': 'innerHTML' }}
                      class="h-12 hover:bg-primary/20 nav-link is-drawer-close:tooltip is-drawer-close:tooltip-right"
                      data-path="/intelligence"
                      data-tip="Intelligence"
                    >
                      <span class="text-xl">🔍</span>
                      <span class="text-base font-semibold is-drawer-close:hidden">Intelligence</span>
                    </a>
                  </li>

                  <li class="menu-disabled opacity-60 cursor-not-allowed">
                    <a class="h-12 is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Whois" tabindex={-1} aria-disabled="true">
                      <span class="text-xl">🌐</span>
                      <span class="text-base font-semibold is-drawer-close:hidden">Whois</span>
                    </a>
                  </li>

                  <li class="menu-disabled opacity-60 cursor-not-allowed">
                    <a class="h-12 is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="NMAP / RustScan" tabindex={-1} aria-disabled="true">
                      <span class="text-xl">🔎</span>
                      <span class="text-base font-semibold is-drawer-close:hidden">NMAP / RustScan</span>
                    </a>
                  </li>

                  <li class="menu-disabled opacity-60 cursor-not-allowed">
                    <a class="h-12 is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="HTTP Proxy" tabindex={-1} aria-disabled="true">
                      <span class="text-xl">📡</span>
                      <span class="text-base font-semibold is-drawer-close:hidden">HTTP Proxy</span>
                    </a>
                  </li>

                  <li class="menu-disabled opacity-60 cursor-not-allowed">
                    <a class="h-12 is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="MISP" tabindex={-1} aria-disabled="true">
                      <span class="text-xl">🧩</span>
                      <span class="text-base font-semibold is-drawer-close:hidden">MISP</span>
                    </a>
                  </li>

                  <li class="menu-disabled opacity-60 cursor-not-allowed">
                    <a class="h-12 is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Report Utility" tabindex={-1} aria-disabled="true">
                      <span class="text-xl">📋</span>
                      <span class="text-base font-semibold is-drawer-close:hidden">Report Utility</span>
                    </a>
                  </li>

                  <li class="menu-disabled opacity-60 cursor-not-allowed">
                    <a class="h-12 is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Audit Log" tabindex={-1} aria-disabled="true">
                      <span class="text-xl">📜</span>
                      <span class="text-base font-semibold is-drawer-close:hidden">Audit Log</span>
                    </a>
                  </li>

                  <li class="menu-disabled opacity-60 cursor-not-allowed">
                    <a class="h-12 is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Health" tabindex={-1} aria-disabled="true">
                      <span class="text-xl">⚕️</span>
                      <span class="text-base font-semibold is-drawer-close:hidden">Health</span>
                    </a>
                  </li>

                  <li class="menu-disabled opacity-60 cursor-not-allowed">
                    <a class="h-12 is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Configuration" tabindex={-1} aria-disabled="true">
                      <span class="text-xl">⚙️</span>
                      <span class="text-base font-semibold is-drawer-close:hidden">Configuration</span>
                    </a>

                  </li>

                </ul>
              </div>

              {/* SIDEBAR FOOTER */}
              <div class="border-t border-base-300 p-2.5 space-y-1.5 mt-auto shrink-0">
                {/* STATUS INDICATOR */}
                <div class="badge badge-md badge-outline w-full gap-1 text-xs is-drawer-close:hidden">
                  <span class="status status-success status-xs"></span>
                  All Systems OK
                </div>

                {/* ACTION BUTTON */}
                <button class="btn btn-primary btn-sm w-full is-drawer-close:hidden">
                  💬 Report
                </button>

                {/* HELP LINK */}
                <a class="link link-hover text-xs opacity-50 block text-center is-drawer-close:hidden">
                  Help
                </a>

                {/* SIDEBAR TOGGLE */}
                <div class="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Expand Sidebar">
                  <label for="sidebar" class="btn btn-ghost btn-sm w-full flex items-center justify-center drawer-button cursor-pointer">
                    ↔
                  </label>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Keep active sidebar link in sync with the current URL (initial load + htmx navigations) */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function () {
            function syncNav() {
              var p = location.pathname.replace(/\/$/, '') || '/';
              document.querySelectorAll('.nav-link').forEach(function (el) {
                var target = (el.getAttribute('data-path') || '').replace(/\/$/, '') || '/';
                el.classList.toggle('active', target === p);
              });
            }
            syncNav();
            document.addEventListener('htmx:afterSettle', syncNav);
          })();
        `}} />

      </body>
    </html>
  )
})