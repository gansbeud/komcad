import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { renderer } from './renderer'
import landingRoutes from './routes/landing'
import authRoutes from './routes/auth'
import intelligenceRoutes from './routes/intelligence'
import whoisRoutes from './routes/whois'
import auditlogRoutes from './routes/auditlog'
import apiRoutes from './routes/api'
import dashboardMockRoutes from './routes/dashboard-mock'
import newsRoutes from './routes/news'

const app = new Hono()

// ── Public routes — no auth required ────────────────────────────────────────
app.route('/', landingRoutes)          // landing page
app.route('/', authRoutes)             // /login, /logout
app.route('/api', apiRoutes)           // /api/contact (public) + legacy /api/report

// ── JWT auth guard ────────────────────────────────────────────────────────────
async function jwtGuard(c: any, next: any) {
  const token = getCookie(c, 'komcad_token')
  if (!token) return c.redirect('/login')
  try {
    const env = c.env as any
    const secret = env?.JWT_SECRET ?? process.env.JWT_SECRET ?? 'komcad-dev-secret'
    const payload = await verify(token, secret, 'HS256') as any
    c.set('username', payload.sub ?? 'User')
  } catch {
    return c.redirect('/login')
  }
  return next()
}

app.use('/app', jwtGuard)
app.use('/app/*', jwtGuard)

// ── App layout middleware (authenticated routes only) ────────────────────────
app.use('/app', renderer)
app.use('/app/*', renderer)

// ── Protected app routes ────────────────────────────────────────────────────
app.route('/app', dashboardMockRoutes)
app.route('/app/news', newsRoutes)
app.route('/app/intelligence', intelligenceRoutes)
app.route('/app/whois', whoisRoutes)
app.route('/app/admin', auditlogRoutes)

export default app