import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { renderer } from './renderer'
import authRoutes from './routes/auth'
import intelligenceRoutes from './routes/intelligence'
import whoisRoutes from './routes/whois'
import auditlogRoutes from './routes/auditlog'
import adminManageRoutes from './routes/admin-manage'
import apiRoutes from './routes/api'
import dashboardMockRoutes from './routes/dashboard-mock'
import newsRoutes from './routes/news'
import './style.css' // Import CSS so Vite resolves it correctly in both dev and prod

const app = new Hono()

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
    c.set('user_id', payload.sub ?? 'unknown')
    c.set('username', payload.user ?? 'User')
    c.set('role', payload.role ?? 'user')
  } catch {
    return c.redirect('/login')
  }
  return next()
})

// ── Admin role guard ─────────────────────────────────────────────────────────
app.use('/admin/*', async (c, next) => {
  const role = c.get('role')
  if (role !== 'admin') {
    return c.render(
      <div class="space-y-4">
        <h1 class="text-4xl font-bold mb-2">Access Denied</h1>
        <div class="alert alert-error">
          <span>You do not have permission to access this page. Admin role required.</span>
        </div>
        <a href="/" class="btn btn-primary">Return to Dashboard</a>
      </div>,
      { title: 'Access Denied' }
    )
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
app.route('/admin/auditlog', auditlogRoutes)
app.route('/admin/manage', adminManageRoutes)
app.route('/api', apiRoutes)

export default app