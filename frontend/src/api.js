const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.error || `Request failed: ${res.status}`)
  }

  return res.json().catch(() => ({}))
}

export const api = {
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  reports: () => request('/reports'),
  adminUsers: () => request('/admin/users'),
  createUser: (payload) => request('/admin/users', { method: 'POST', body: JSON.stringify(payload) }),
  createReport: (payload) => request('/admin/reports', { method: 'POST', body: JSON.stringify(payload) }),
  updateUserAccess: (userId, report_ids) =>
    request(`/admin/users/${userId}/report-access`, {
      method: 'PUT',
      body: JSON.stringify({ report_ids })
    })
}
