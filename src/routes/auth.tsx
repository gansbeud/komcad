import { Hono } from 'hono'
import { sign, decode } from 'hono/jwt'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { logAuthEvent } from '../lib/authlog'

type AuthEnv = {
  JWT_SECRET: string
  ADMIN_USER: string
  ADMIN_PASS: string
  DEMO_USER:  string
  DEMO_PASS:  string
}

const auth = new Hono<{ Bindings: AuthEnv }>()

// ── Login brute-force protection (in-memory, best-effort) ─────────────────
// Note: resets per Worker isolate restart. For persistent limits use CF Rate Limiting.
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const LOGIN_MAX = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 min

// ── GET /login ─────────────────────────────────────────────────────────────
auth.get('/login', (c) => {
  const hasError = c.req.query('error') === '1'
  return c.html(loginPage(hasError))
})

// ── POST /login ────────────────────────────────────────────────────────────
auth.post('/login', async (c) => {
  const clientIp = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown'
  const now = Date.now()
  const current = loginAttempts.get(clientIp)
  if (current && now < current.resetAt) {
    if (current.count >= LOGIN_MAX) {
      await logAuthEvent('login_failure', 'unknown', c.req.raw, { reason: `rate_limit:${clientIp}` })
      return c.redirect('/login?error=1')
    }
    current.count++
  } else {
    loginAttempts.set(clientIp, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
  }

  const body     = await c.req.parseBody()
  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')

  const env = c.env as AuthEnv
  // process.env fallback covers local Vite dev (dotenv loads .env.local into process.env
  // but the Cloudflare adapter does NOT populate c.env from .env.local)
  const getEnvVar = (key: keyof AuthEnv) =>
    (env?.[key] as string) ?? (process.env[key] as string | undefined) ?? ''

  const valid = [
    { user: getEnvVar('ADMIN_USER'), pass: getEnvVar('ADMIN_PASS') },
    { user: getEnvVar('DEMO_USER'),  pass: getEnvVar('DEMO_PASS')  },
  ].find((u) => u.user && u.user === username && u.pass === password)

  if (!valid) {
    await logAuthEvent('login_failure', username, c.req.raw, { reason: 'invalid_credentials' })
    return c.redirect('/login?error=1')
  }

  const secret = getEnvVar('JWT_SECRET') || 'komcad-dev-secret'
  const token  = await sign(
    { sub: username, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 },
    secret,
    'HS256'
  )

  const sessionExpiresAt = new Date((Math.floor(Date.now() / 1000) + 60 * 60 * 8) * 1000)
  setCookie(c, 'komcad_token', token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 8,
    sameSite: 'Lax',
  })

  await logAuthEvent('login_success', username, c.req.raw, { sessionExpiresAt })
  loginAttempts.delete(clientIp)
  return c.redirect('/')
})

// ── GET /logout ────────────────────────────────────────────────────────────
auth.get('/logout', async (c) => {
  const token = getCookie(c, 'komcad_token')
  let username = 'unknown'
  if (token) {
    try { username = (decode(token).payload as any)?.sub ?? 'unknown' } catch {}
  }
  deleteCookie(c, 'komcad_token', { path: '/' })
  await logAuthEvent('logout', username, c.req.raw)
  return c.redirect('/login')
})

// ── Login page HTML ────────────────────────────────────────────────────────
function loginPage(hasError: boolean): string {
  return `<!DOCTYPE html>
<html data-theme="dim">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KOMCAD — Login</title>
  <link rel="stylesheet" href="/static/style.css" />
</head>
<body class="bg-base-200 min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-sm space-y-6">

    <!-- Branding -->
    <div class="text-center space-y-2">
      <div class="flex justify-center">
        <div class="badge badge-primary badge-xl text-xl font-bold py-4 px-6">◆ KOMCAD</div>
      </div>
      <p class="text-base-content/50 text-sm">Command of Cyber &amp; Active Defense</p>
    </div>

    <!-- Card -->
    <div class="card bg-base-100 border border-base-300 shadow-xl">
      <div class="card-body gap-4">
        <h2 class="card-title text-lg justify-center">Sign In</h2>

        ${hasError ? `
        <div class="alert alert-error alert-soft text-sm">
          <span>⚠ Invalid username or password.</span>
        </div>` : ''}

        <form method="POST" action="/login" class="space-y-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Username</legend>
            <input
              type="text"
              name="username"
              class="input input-bordered w-full focus:input-primary"
              placeholder="Enter username"
              autocomplete="username"
              required
              autofocus
            />
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">Password</legend>
            <input
              type="password"
              name="password"
              class="input input-bordered w-full focus:input-primary"
              placeholder="Enter password"
              autocomplete="current-password"
              required
            />
          </fieldset>

          <button type="submit" class="btn btn-primary w-full mt-2">
            Login →
          </button>
        </form>
      </div>
    </div>

    <p class="text-center text-xs text-base-content/30">
      © 2026 KOMCAD
    </p>
  </div>
</body>
</html>`
}

export default auth
