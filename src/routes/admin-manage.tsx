import { Hono } from 'hono'
import { getDB, query, queryOne, execute } from '../lib/db'
import { hashPassword, generateUUID } from '../lib/crypto'
import { nowISO } from '../lib/db'

const adminManage = new Hono()

interface UserRow {
  id: string
  username: string
  password_hash: string
  role: string
  created_at: string
  updated_at: string
}

type UserListRow = Pick<UserRow, 'id' | 'username' | 'role' | 'created_at' | 'updated_at'>

const allowedRoles = ['admin', 'demo', 'user'] as const

function roleBadgeClass(role: string): string {
  if (role === 'admin') return 'badge-error'
  if (role === 'demo') return 'badge-warning'
  return 'badge-info'
}

function alertHtml(
  kind: 'error' | 'success' | 'warning' | 'info',
  message: string
): JSX.Element {
  return (
    <div class={`alert alert-${kind} alert-soft`}>
      <span>{message}</span>
    </div>
  )
}

function renderUsersList(users: UserListRow[]): JSX.Element {
  return (
    <div id="user-list" class="overflow-x-auto">
      {users.length === 0 ? (
        <div class="alert alert-info">
          <span>No users found</span>
        </div>
      ) : (
        <table class="table table-sm table-zebra w-full">
          <thead>
            <tr class="border-base-300">
              <th>#</th>
              <th>Username</th>
              <th>Role</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr key={user.id} class="border-base-300">
                <td class="opacity-40 text-xs">{i + 1}</td>
                <td class="font-mono">{user.username}</td>
                <td>
                  <span class={`badge ${roleBadgeClass(user.role)}`}>{user.role}</span>
                </td>
                <td class="text-xs opacity-70">{new Date(user.created_at).toLocaleDateString()}</td>
                <td class="text-xs opacity-70">{new Date(user.updated_at).toLocaleDateString()}</td>
                <td class="space-x-2">
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost"
                    {...{
                      'hx-get': `/admin/manage/edit/${user.id}`,
                      'hx-target': '#modal-content',
                      'hx-swap': 'innerHTML',
                      onclick: "document.getElementById('edit_modal').showModal()"
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost btn-error"
                    {...{
                      'hx-post': `/admin/manage/delete/${user.id}`,
                      'hx-confirm': 'Are you sure you want to delete this user? This cannot be undone.',
                      'hx-target': '#table-message',
                      'hx-swap': 'innerHTML',
                      'hx-on::after-request': "if (event.detail.successful) { htmx.ajax('GET', '/admin/manage/list', { target: '#user-list', swap: 'outerHTML' }); } else { document.getElementById('table-message').innerHTML = event.detail.xhr.responseText; }"
                    }}
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

async function fetchUsers(c: Parameters<typeof getDB>[0]): Promise<UserListRow[]> {
  const db = getDB(c)
  return query<UserListRow>(
    db,
    'SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at DESC'
  )
}

// ── GET /admin/manage — Display user management page ────────────────────────
adminManage.get('/', async (c) => {
  try {
    const users = await fetchUsers(c)

    return c.render(
      <div class="space-y-6">
        <div>
          <h1 class="text-4xl font-bold mb-2">User Management</h1>
          <p class="text-base-content/70">
            Create, update, or delete users - visible only to admins
          </p>
        </div>

        {/* Add New User Section */}
        <div class="card bg-base-100 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg">Add New User</h2>
            <div id="form-message" class="min-h-0"></div>
            <form
              method="post"
              action="/admin/manage/create"
              class="space-y-4"
              hx-post="/admin/manage/create"
              hx-target="#form-message"
              hx-swap="innerHTML"
              {...{
                'hx-on::after-request': "if (event.detail.successful) { this.reset(); htmx.ajax('GET', '/admin/manage/list', { target: '#user-list', swap: 'outerHTML' }); } else { document.getElementById('form-message').innerHTML = event.detail.xhr.responseText; }"
              }}
            >
              <div class="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div class="form-control">
                  <label class="label">
                    <span class="label-text">Username</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    placeholder="Enter username"
                    class="input input-bordered"
                    required
                  />
                </div>

                <div class="form-control">
                  <label class="label">
                    <span class="label-text">Password</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    placeholder="Enter password"
                    class="input input-bordered"
                    required
                  />
                </div>

                <div class="form-control">
                  <label class="label">
                    <span class="label-text">Role</span>
                  </label>
                  <select name="role" class="select select-bordered" required>
                    <option value="">Select role</option>
                    <option value="admin">Admin</option>
                    <option value="demo">Demo</option>
                    <option value="user">User</option>
                  </select>
                </div>
              </div>

              <button type="submit" class="btn btn-primary">
                ➕ Create User
              </button>
            </form>
          </div>
        </div>

        {/* Users Table */}
        <div class="card bg-base-100 shadow-md border border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg">Users</h2>
            <div id="table-message" class="min-h-0 mb-3"></div>
            {renderUsersList(users)}
          </div>
        </div>
      </div>,
      { title: 'User Management' }
    )
  } catch (error) {
    console.error('User management error:', error)
    return c.render(
      <div class="space-y-4">
        <h1 class="text-4xl font-bold mb-2">User Management</h1>
        <div class="alert alert-error">
          <span>Error loading user management: {error instanceof Error ? error.message : 'Unknown error'}</span>
        </div>
      </div>,
      { title: 'User Management - Error' }
    )
  }
})

// ── GET /admin/manage/list — Refresh users table partial ────────────────────
adminManage.get('/list', async (c) => {
  try {
    const users = await fetchUsers(c)
    return c.html(renderUsersList(users))
  } catch (error) {
    console.error('User list refresh error:', error)
    return c.html(
      <div id="user-list">
        {alertHtml('error', `Error refreshing users list: ${error instanceof Error ? error.message : 'Unknown error'}`)}
      </div>,
      500
    )
  }
})

// ── POST /admin/manage/create — Create new user ─────────────────────────────
adminManage.post('/create', async (c) => {
  try {
    const db = getDB(c)
    const formData = await c.req.formData()

      const username = String(formData.get('username') ?? '')
      const password = String(formData.get('password') ?? '')
      const role = String(formData.get('role') ?? 'user')

    const userId = generateUUID()
    const passwordHash = await hashPassword(password)
    const now = nowISO()

    await execute(
      db,
      `
      INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [userId, username, passwordHash, role, now, now]
    )

    return c.html(alertHtml('success', `User "${username}" created successfully`))
  } catch (error) {
    console.error('User creation error:', error)
    return c.html(
      alertHtml('error', `Error creating user: ${error instanceof Error ? error.message : 'Unknown error'}`),
      500
    )
  }
})

// ── GET /admin/manage/edit/:id — Get edit form for user ─────────────────────
adminManage.get('/edit/:id', async (c) => {
  try {
    const db = getDB(c)
    const userId = c.req.param('id')

    const user = await queryOne<Pick<UserRow, 'id' | 'username' | 'role'>>(
      db,
      'SELECT id, username, role FROM users WHERE id = ?',
      [userId]
    )

    if (!user) {
      return c.html(alertHtml('error', 'User not found'), 404)
    }

    return c.html(
      <div class="space-y-4">
        <h3 class="text-lg font-bold">Edit User: {user.username}</h3>
        <div id="edit-message" class="min-h-0"></div>
        <form
          method="post"
          {...{
            action: `/admin/manage/update/${user.id}`,
            class: 'space-y-4',
            'hx-post': `/admin/manage/update/${user.id}`,
            'hx-target': '#edit-message',
            'hx-swap': 'innerHTML',
            'hx-on::after-request': "if (event.detail.successful) { document.getElementById('edit_modal').close(); htmx.ajax('GET', '/admin/manage/list', { target: '#user-list', swap: 'outerHTML' }); } else { document.getElementById('edit-message').innerHTML = event.detail.xhr.responseText; }"
          }}
        >
          <div class="form-control">
            <label class="label">
              <span class="label-text">Username</span>
            </label>
            <input
              type="text"
              name="username"
              value={user.username}
              class="input input-bordered"
              required
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">New Password (leave blank to keep current)</span>
            </label>
            <input
              type="password"
              name="password"
              placeholder="Leave blank to keep current password"
              class="input input-bordered"
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Role</span>
            </label>
            <select name="role" class="select select-bordered" required>
              <option value="admin" selected={user.role === 'admin'}>Admin</option>
              <option value="demo" selected={user.role === 'demo'}>Demo</option>
              <option value="user" selected={user.role === 'user'}>User</option>
            </select>
          </div>

          <div class="flex gap-2">
            <button type="submit" class="btn btn-primary">
              💾 Update User
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              onclick="document.getElementById('edit_modal').close()"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    )
  } catch (error) {
    console.error('Edit user error:', error)
    return c.html(
      alertHtml('error', `Error loading user: ${error instanceof Error ? error.message : 'Unknown error'}`),
      500
    )
  }
})

// ── POST /admin/manage/update/:id — Update user ─────────────────────────────
adminManage.post('/update/:id', async (c) => {
  try {
    const db = getDB(c)
    const userId = c.req.param('id')
    const formData = await c.req.formData()

    const username = String(formData.get('username') ?? '').trim()
    const password = String(formData.get('password') ?? '').trim()
    const role = String(formData.get('role') ?? 'user').trim()

    if (!username || username.length < 3) {
      return c.html(alertHtml('error', 'Username must be at least 3 characters'), 400)
    }

    if (!allowedRoles.includes(role as (typeof allowedRoles)[number])) {
      return c.html(alertHtml('error', 'Invalid role selected'), 400)
    }

    if (password.length > 0 && password.length < 6) {
      return c.html(alertHtml('error', 'New password must be at least 6 characters'), 400)
    }

    const existing = await queryOne<Pick<UserRow, 'id'>>(
      db,
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [username, userId]
    )

    if (existing) {
      return c.html(alertHtml('warning', `Username "${username}" is already taken by another user`), 409)
    }

    const now = nowISO()

    if (password.length > 0) {
      const passwordHash = await hashPassword(password)
      await execute(
        db,
        'UPDATE users SET username = ?, password_hash = ?, role = ?, updated_at = ? WHERE id = ?',
        [username, passwordHash, role, now, userId]
      )
    } else {
      await execute(
        db,
        'UPDATE users SET username = ?, role = ?, updated_at = ? WHERE id = ?',
        [username, role, now, userId]
      )
    }

    return c.html(alertHtml('success', `User "${username}" updated successfully`))
  } catch (error) {
    console.error('User update error:', error)
    return c.html(
      alertHtml('error', `Error updating user: ${error instanceof Error ? error.message : 'Unknown error'}`),
      500
    )
  }
})

// ── POST /admin/manage/delete/:id — Delete user ─────────────────────────────
adminManage.post('/delete/:id', async (c) => {
  try {
    const db = getDB(c)
    const userId = c.req.param('id')

    const user = await queryOne<Pick<UserRow, 'username'>>(
      db,
      'SELECT username FROM users WHERE id = ?',
      [userId]
    )

    if (!user) {
      return c.html(alertHtml('error', 'User not found'), 404)
    }

    await execute(db, 'DELETE FROM users WHERE id = ?', [userId])

    return c.html(alertHtml('success', `User "${user.username}" deleted successfully`))
  } catch (error) {
    console.error('User deletion error:', error)
    return c.html(
      alertHtml('error', `Error deleting user: ${error instanceof Error ? error.message : 'Unknown error'}`),
      500
    )
  }
})

export default adminManage
