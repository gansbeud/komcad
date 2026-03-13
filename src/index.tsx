import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { serveStatic } from 'hono/serve-static'
import { renderer } from './renderer'
import authRoutes from './routes/auth'
import intelligenceRoutes from './routes/intelligence'
import whoisRoutes from './routes/whois'
import auditlogRoutes from './routes/auditlog'
import apiRoutes from './routes/api'
import dashboardMockRoutes from './routes/dashboard-mock'
import newsRoutes from './routes/news'

const app = new Hono()

// ── Static files (bypass all middleware) ──────────────────────────────────────
app.use('/static/*', serveStatic({ root: './dist' }))

// ── Public auth routes (no JWT guard) — must be registered first ────────────
app.route('/', authRoutes)

// ── JWT auth guard for all other routes ─────────────────────────────────────
app.use('*', async (c, next) => {
  const path = c.req.path
  const isStaticAsset = path.startsWith('/assets/') || /\.(css|js|mjs|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|map)$/i.test(path)
  if (path === '/login' || path.startsWith('/login/') || path === '/logout' || path.startsWith('/static/') || isStaticAsset) return next()
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
})

// ── App layout middleware (authenticated routes only) ────────────────────────
app.use('*', renderer)

// ── Protected routes ─────────────────────────────────────────────────────────
app.route('/', dashboardMockRoutes)

app.route('/news', newsRoutes)
app.route('/intelligence', intelligenceRoutes)
app.route('/whois', whoisRoutes)
app.route('/admin', auditlogRoutes)
app.route('/api', apiRoutes)

export default app