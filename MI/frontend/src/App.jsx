import { useEffect, useMemo, useRef, useState } from 'react'
import { factories, models, service as pbiService } from 'powerbi-client'
import { api } from './api'

function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('ChangeMe123!')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const data = await api.login(email, password)
      onLoggedIn(data.user)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <main className="centered-page">
      <form className="card login-card" onSubmit={submit}>
        <h1>Power BI Portal</h1>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Login</button>
      </form>
    </main>
  )
}

function ReportEmbed({ report }) {
  const ref = useRef(null)
  const powerbi = useMemo(
    () => new pbiService.Service(factories.hpmFactory, factories.wpmpFactory, factories.routerFactory),
    []
  )

  useEffect(() => {
    if (!ref.current || !report) return

    powerbi.reset(ref.current)
    const embedConfig = {
      type: 'report',
      id: report.report_id,
      embedUrl: report.embed_url,
      accessToken: report.embed_token || '',
      tokenType: models.TokenType.Embed,
      settings: {
        panes: {
          filters: { visible: false },
          pageNavigation: { visible: true }
        }
      }
    }

    powerbi.embed(ref.current, embedConfig)

    return () => {
      if (ref.current) powerbi.reset(ref.current)
    }
  }, [powerbi, report])

  if (!report) return <p className="muted">Select a report to embed.</p>

  if (!report.embed_token) {
    return (
      <div className="card">
        <p>
          Report <strong>{report.name}</strong> has no embed token stored. Add an `embed_token` in admin report setup.
        </p>
      </div>
    )
  }

  return <div ref={ref} className="embed-container" />
}

function AdminPanel({ reports, users, refreshAdmin }) {
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' })
  const [newReport, setNewReport] = useState({
    name: '',
    report_id: '',
    embed_url: '',
    embed_token: '',
    dataset_id: '',
    workspace_id: ''
  })
  const [error, setError] = useState('')

  async function createUser(event) {
    event.preventDefault()
    setError('')
    try {
      await api.createUser(newUser)
      setNewUser({ email: '', password: '', role: 'user' })
      await refreshAdmin()
    } catch (err) {
      setError(err.message)
    }
  }

  async function createReport(event) {
    event.preventDefault()
    setError('')
    try {
      await api.createReport({
        ...newReport,
        embed_token: newReport.embed_token || null,
        dataset_id: newReport.dataset_id || null,
        workspace_id: newReport.workspace_id || null
      })
      setNewReport({ name: '', report_id: '', embed_url: '', embed_token: '', dataset_id: '', workspace_id: '' })
      await refreshAdmin()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggleUserAccess(userId, reportId, checked, currentAccess) {
    setError('')
    const updated = new Set(currentAccess.map((r) => r.id))
    if (checked) updated.add(reportId)
    else updated.delete(reportId)

    try {
      await api.updateUserAccess(userId, Array.from(updated))
      await refreshAdmin()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="admin-grid">
      <div className="card">
        <h3>Create User</h3>
        <form onSubmit={createUser} className="stack">
          <input
            type="email"
            placeholder="email"
            value={newUser.email}
            onChange={(e) => setNewUser((v) => ({ ...v, email: e.target.value }))}
            required
          />
          <input
            type="password"
            placeholder="password"
            value={newUser.password}
            onChange={(e) => setNewUser((v) => ({ ...v, password: e.target.value }))}
            required
          />
          <select value={newUser.role} onChange={(e) => setNewUser((v) => ({ ...v, role: e.target.value }))}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <button type="submit">Create User</button>
        </form>
      </div>

      <div className="card">
        <h3>Add Report</h3>
        <form onSubmit={createReport} className="stack">
          <input
            placeholder="name"
            value={newReport.name}
            onChange={(e) => setNewReport((v) => ({ ...v, name: e.target.value }))}
            required
          />
          <input
            placeholder="report_id"
            value={newReport.report_id}
            onChange={(e) => setNewReport((v) => ({ ...v, report_id: e.target.value }))}
            required
          />
          <input
            placeholder="embed_url"
            value={newReport.embed_url}
            onChange={(e) => setNewReport((v) => ({ ...v, embed_url: e.target.value }))}
            required
          />
          <input
            placeholder="embed_token (optional but required for embed)"
            value={newReport.embed_token}
            onChange={(e) => setNewReport((v) => ({ ...v, embed_token: e.target.value }))}
          />
          <input
            placeholder="dataset_id (optional)"
            value={newReport.dataset_id}
            onChange={(e) => setNewReport((v) => ({ ...v, dataset_id: e.target.value }))}
          />
          <input
            placeholder="workspace_id (optional)"
            value={newReport.workspace_id}
            onChange={(e) => setNewReport((v) => ({ ...v, workspace_id: e.target.value }))}
          />
          <button type="submit">Add Report</button>
        </form>
      </div>

      <div className="card wide">
        <h3>User Report Access</h3>
        {users.map((user) => (
          <div key={user.id} className="user-access-row">
            <div>
              <strong>{user.email}</strong> ({user.role})
            </div>
            <div className="checkbox-grid">
              {reports.map((report) => {
                const checked = user.report_access.some((r) => r.id === report.id)
                return (
                  <label key={`${user.id}-${report.id}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleUserAccess(user.id, report.id, e.target.checked, user.report_access)}
                    />
                    {report.name}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [reports, setReports] = useState([])
  const [users, setUsers] = useState([])
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [error, setError] = useState('')

  async function refreshReports() {
    const data = await api.reports()
    setReports(data.reports)
    if (!selectedReportId && data.reports.length) setSelectedReportId(data.reports[0].id)
  }

  async function refreshAdmin() {
    await refreshReports()
    if (user?.role === 'admin') {
      const data = await api.adminUsers()
      setUsers(data.users)
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await api.me()
        setUser(me.user)
        await refreshReports()
        if (me.user.role === 'admin') {
          const data = await api.adminUsers()
          setUsers(data.users)
        }
      } catch {
        setUser(null)
      }
    }
    bootstrap()
  }, [])

  async function logout() {
    await api.logout()
    setUser(null)
    setReports([])
    setUsers([])
    setSelectedReportId(null)
  }

  if (!user) {
    return <Login onLoggedIn={async (loggedInUser) => {
      setUser(loggedInUser)
      setError('')
      try {
        await refreshReports()
        if (loggedInUser.role === 'admin') {
          const data = await api.adminUsers()
          setUsers(data.users)
        }
      } catch (err) {
        setError(err.message)
      }
    }} />
  }

  const selectedReport = reports.find((r) => r.id === selectedReportId) || null

  return (
    <main className="layout">
      <header className="topbar card">
        <div>
          <h1>Power BI Portal</h1>
          <p className="muted">{user.email} ({user.role})</p>
        </div>
        <button onClick={logout}>Logout</button>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="content-grid">
        <aside className="card report-list">
          <h2>Reports</h2>
          {reports.length === 0 && <p className="muted">No reports available for your account.</p>}
          {reports.map((report) => (
            <button
              className={report.id === selectedReportId ? 'report-btn active' : 'report-btn'}
              key={report.id}
              onClick={() => setSelectedReportId(report.id)}
            >
              {report.name}
            </button>
          ))}
        </aside>

        <section className="card embed-area">
          <h2>{selectedReport ? selectedReport.name : 'Embedded Report'}</h2>
          <ReportEmbed report={selectedReport} />
        </section>
      </section>

      {user.role === 'admin' && <AdminPanel reports={reports} users={users} refreshAdmin={refreshAdmin} />}
    </main>
  )
}
