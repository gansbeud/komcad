import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children, title }) => {
  return (
    <html lang="en" data-theme="cupcake">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <title>{title ?? 'Dashboard'}</title>

        <link rel="stylesheet" href="/src/style.css" />

        {/* Prevent theme flicker + save theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              const t = localStorage.getItem('theme') || 'cupcake';
              document.documentElement.dataset.theme = t;

              document.addEventListener('change', e => {
                if(e.target.classList.contains('theme-controller')){
                  const v = e.target.value;
                  localStorage.setItem('theme', v);
                  document.documentElement.dataset.theme = v;
                }
              });
            `,
          }}
        />
      </head>

      <body className="bg-base-200">
        <div className="drawer lg:drawer-open">

          <input id="my-drawer" type="checkbox" className="drawer-toggle" />

          {/* PAGE CONTENT */}
          <div className="drawer-content flex flex-col">

            {/* TOP NAVBAR */}
            <div className="navbar bg-base-100 shadow-sm px-4">

              {/* MOBILE MENU BUTTON */}
              <div className="flex-1 lg:hidden">
                <label htmlFor="my-drawer" className="btn btn-square btn-ghost">
                  ☰
                </label>
              </div>

              {/* RIGHT SIDE */}
              <div className="flex-none">

                {/* THEME DROPDOWN */}
                <div className="dropdown dropdown-end">

                  <div tabIndex={0} role="button" className="btn btn-ghost">
                    Themes
                  </div>

                  <ul
                    tabIndex={0}
                    className="dropdown-content z-[1] p-2 shadow-2xl bg-base-300 rounded-box w-52"
                  >
                    <li>
                      <input
                        type="radio"
                        name="theme"
                        value="default"
                        aria-label="Default"
                        className="theme-controller btn btn-sm btn-block btn-ghost justify-start"
                      />
                    </li>

                    <li>
                      <input
                        type="radio"
                        name="theme"
                        value="retro"
                        aria-label="Retro"
                        className="theme-controller btn btn-sm btn-block btn-ghost justify-start"
                      />
                    </li>

                    <li>
                      <input
                        type="radio"
                        name="theme"
                        value="cyberpunk"
                        aria-label="Cyberpunk"
                        className="theme-controller btn btn-sm btn-block btn-ghost justify-start"
                      />
                    </li>

                    <li>
                      <input
                        type="radio"
                        name="theme"
                        value="valentine"
                        aria-label="Valentine"
                        className="theme-controller btn btn-sm btn-block btn-ghost justify-start"
                      />
                    </li>

                    <li>
                      <input
                        type="radio"
                        name="theme"
                        value="aqua"
                        aria-label="Aqua"
                        className="theme-controller btn btn-sm btn-block btn-ghost justify-start"
                      />
                    </li>
                  </ul>

                </div>
              </div>
            </div>

            {/* MAIN CONTENT */}
            <main className="p-4 md:p-8">
              {children}
            </main>

          </div>

          {/* SIDEBAR */}
          <div className="drawer-side">

            <label htmlFor="my-drawer" className="drawer-overlay"></label>

            <ul className="menu p-4 w-80 min-h-full bg-base-100 text-base-content">

              <li className="text-xl font-bold p-4 text-primary">
                MVP Dashboard
              </li>

              <div className="divider">Menu</div>

              <li><a href="/">Dashboard</a></li>
              <li><a href="/components">Components</a></li>
              <li><a href="/layouts">Layouts</a></li>

            </ul>

          </div>
        </div>
      </body>
    </html>
  )
})