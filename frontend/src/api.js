const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = Array.isArray(body.detail)
      ? body.detail.map((item) => item.msg).join(', ')
      : body.detail
    throw new Error(detail || body.error || `Request failed: ${res.status}`)
  }

  return res.json().catch(() => ({}))
}

export const api = {
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password })
    }),
  changePassword: (current_password, new_password) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password })
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  reports: () => request('/reports'),
  adminUsers: () => request('/admin/users'),
  createUser: (payload) => request('/admin/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (userId, payload) => request(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  resetUserPassword: (userId, new_password) =>
    request(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password })
    }),
  createReport: (payload) => request('/admin/reports', { method: 'POST', body: JSON.stringify(payload) }),
  updateReport: (reportId, payload) => request(`/admin/reports/${reportId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteReport: (reportId) => request(`/admin/reports/${reportId}`, { method: 'DELETE' }),
  updateUserAccess: (userId, report_ids) =>
    request(`/admin/users/${userId}/report-access`, {
      method: 'PUT',
      body: JSON.stringify({ report_ids })
    })
}
