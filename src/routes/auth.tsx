import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { logAuthEvent } from '../lib/authlog'
import { getDB } from '../lib/db'
import { queryOne, nowISO } from '../lib/db'
import { verifyPassword } from '../lib/crypto'
import { createSession, validateSession, expireSession } from '../lib/session'
import { checkRateLimit, recordAttempt } from '../lib/ratelimit-db'

type AuthEnv = {
  JWT_SECRET: string
}

type User = {
  id: string
  username: string
  password_hash: string
  role: string
  is_active: number
}

const auth = new Hono<{ Bindings: AuthEnv }>()

const LOGIN_MAX = 10
const LOGIN_WINDOW_MINUTES = 15

// ── Helper: Get client IP ──────────────────────────────────────────────────
function getClientIp(c: any): string {
  // Try multiple header sources for IP detection (works in dev and Cloudflare Workers)
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'unknown'
  )
}

// ── Helper: Get user agent ─────────────────────────────────────────────────
function getUserAgent(c: any): string {
  return c.req.header('User-Agent') ?? 'unknown'
}

// ── GET /login ─────────────────────────────────────────────────────────────
auth.get('/login', (c) => {
  const hasError = c.req.query('error') === '1'
  const host = new URL(c.req.url).hostname
  const isLocalDev = host === 'localhost' || host === '127.0.0.1'
  return c.html(loginPage(hasError, isLocalDev))
})

// ── POST /login ────────────────────────────────────────────────────────────
auth.post('/login', async (c) => {
  try {
    const db = getDB(c)
    const clientIp = getClientIp(c)
    const userAgent = getUserAgent(c)

    // Check rate limit
    const { blocked, remaining } = await checkRateLimit(
      db,
      clientIp,
      '/api/auth/login',
      undefined,
      LOGIN_MAX,
      LOGIN_WINDOW_MINUTES
    )

    if (blocked) {
      await logAuthEvent('login_failure', null, c.req.raw, {
        db,
        reason: 'rate_limited',
        ip: clientIp,
      })
      return c.redirect('/login?error=1')
    }

    const body = await c.req.parseBody()
    const username = String(body.username ?? '').trim()
    const password = String(body.password ?? '')

    if (!username || !password) {
      await recordAttempt(db, clientIp, '/api/auth/login', undefined, LOGIN_WINDOW_MINUTES)
      await logAuthEvent('login_failure', null, c.req.raw, {
        db,
        reason: 'missing_credentials',
        ip: clientIp,
      })
      return c.redirect('/login?error=1')
    }

    // Look up user in database
    const user = await queryOne<User>(db, 'SELECT * FROM users WHERE username = ? AND is_active = 1', [username])

    if (!user) {
      await recordAttempt(db, clientIp, '/api/auth/login', undefined, LOGIN_WINDOW_MINUTES)
      await logAuthEvent('login_failure', null, c.req.raw, {
        db,
        reason: `user_not_found: ${username}`,
        ip: clientIp,
      })
      return c.redirect('/login?error=1')
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash)
    if (!passwordValid) {
      await recordAttempt(db, clientIp, '/api/auth/login', user.id, LOGIN_WINDOW_MINUTES)
      await logAuthEvent('login_failure', user.id, c.req.raw, {
        db,
        reason: `invalid_password: ${username}`,
        ip: clientIp,
      })
      return c.redirect('/login?error=1')
    }

    // Password is valid, create session
    const secret = (c.env as AuthEnv)?.JWT_SECRET ?? (process.env.JWT_SECRET as string) ?? 'komcad-dev-secret'
    const { token, sessionId } = await createSession(db, user.id, user.username, user.role, clientIp, userAgent, secret, 8)

    // Update last_login_at
    await queryOne(db, 'UPDATE users SET last_login_at = ? WHERE id = ?', [nowISO(), user.id])

    // Set cookie
    setCookie(c, 'komcad_token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 8,
      sameSite: 'Lax',
    })

    await logAuthEvent('login_success', user.id, c.req.raw, {
      db,
      ip: clientIp,
      sessionId,
    })

    return c.redirect('/')
  } catch (error) {
    console.error('Login error:', error)
    return c.redirect('/login?error=1')
  }
})

// ── GET /logout ────────────────────────────────────────────────────────────
auth.get('/logout', async (c) => {
  try {
    const db = getDB(c)
    const token = getCookie(c, 'komcad_token')
    const clientIp = getClientIp(c)

    if (token) {
      const secret = (c.env as AuthEnv)?.JWT_SECRET ?? (process.env.JWT_SECRET as string) ?? 'komcad-dev-secret'
      const sessionData = await validateSession(db, token, secret)
      if (sessionData) {
        await expireSession(db, sessionData.payload.sid)
        await logAuthEvent('logout', sessionData.session.user_id, c.req.raw, {
          db,
          ip: clientIp,
          sessionId: sessionData.payload.sid,
        })
      }
    }

    deleteCookie(c, 'komcad_token', { path: '/' })
    return c.redirect('/login')
  } catch (error) {
    console.error('Logout error:', error)
    deleteCookie(c, 'komcad_token', { path: '/' })
    return c.redirect('/login')
  }
})

// ── Login page HTML ────────────────────────────────────────────────────────
function loginPage(hasError: boolean, isLocalDev: boolean): string {
  const stylesheetPath = isLocalDev ? '/src/style.css' : '/static/style.css'
  return `<!DOCTYPE html>
<html data-theme="dim">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KOMCAD — Login</title>
  <link rel="stylesheet" href="${stylesheetPath}" />
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
