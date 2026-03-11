import { useEffect, useMemo, useRef, useState } from 'react'
import { factories, models, service as pbiService } from 'powerbi-client'
import { api } from './api'

const logoSrc = `${import.meta.env.BASE_URL}LPG-Logo-White-Landscape-RBG.png`

function getPageFromLocation() {
  return window.location.hash === '#/admin' ? 'admin' : 'reports'
}

function navigateTo(page) {
  const nextHash = page === 'admin' ? '#/admin' : '#/'
  if (window.location.hash === nextHash) return
  window.location.hash = nextHash
}

function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('')
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
        <div className="login-layout">
          <div className="login-brand-square">
            <img src={logoSrc} alt="LPG Shared Reports" className="app-logo login-logo" />
          </div>
          <div className="login-fields">
            <h1>LPG Shared Reports</h1>
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
          </div>
        </div>
      </form>
    </main>
  )
}

function PasswordChangeGate({ user, onPasswordChanged, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    setSaving(true)
    try {
      const data = await api.changePassword(currentPassword, newPassword)
      onPasswordChanged(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="centered-page">
      <form className="card login-card" onSubmit={submit}>
        <h1>Change Password</h1>
        <p className="muted">
          {user.email} must set a new password before continuing.
        </p>
        <label>
          Current Password
          <input
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        <label>
          New Password
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" minLength={8} required />
        </label>
        <label>
          Confirm New Password
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            minLength={8}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Update Password'}</button>
          <button type="button" className="secondary-btn" onClick={onLogout}>Logout</button>
        </div>
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

  if (!report) return <p className="muted">Select a report to embed.</p>

  const token = report.embed_token
  const hasEmbedToken =
    token != null && typeof token === 'string' && token.trim() !== '' && token !== 'null'

  // PUBLIC POWER BI (Publish to Web): no token, use iframe
  if (!hasEmbedToken) {
    if (report.embed_url) {
      return (
        <iframe
          title={report.name}
          src={report.embed_url}
          width="100%"
          height="900"
          style={{ border: 'none' }}
          allowFullScreen
        />
      )
    }
    return (
      <p className="muted">Report &quot;{report.name}&quot; has no embed URL or token.</p>
    )
  }

  // SECURE POWER BI EMBED (powerbi-client)
  useEffect(() => {
    if (!ref.current) return

    powerbi.reset(ref.current)

    const embedConfig = {
      type: 'report',
      id: report.report_id,
      embedUrl: report.embed_url,
      accessToken: report.embed_token,
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

  return <div ref={ref} className="embed-container" />
}

function formatUserName(user) {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
  return fullName || user?.email || 'Unnamed user'
}

function AdminPanel({ reports, users, refreshAdmin }) {
  const emptyUser = { first_name: '', last_name: '', email: '', password: '', role: 'user' }
  const emptyReport = { name: '', report_id: '', embed_url: '', embed_token: '', dataset_id: '', workspace_id: '' }
  const [activeTab, setActiveTab] = useState('users')
  const [userSearch, setUserSearch] = useState('')
  const [accessSearch, setAccessSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? null)
  const [selectedAccessUserId, setSelectedAccessUserId] = useState(users[0]?.id ?? null)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showAddReport, setShowAddReport] = useState(false)
  const [newUser, setNewUser] = useState(emptyUser)
  const [newReport, setNewReport] = useState(emptyReport)
  const [userDraft, setUserDraft] = useState(null)
  const [passwordResetValue, setPasswordResetValue] = useState('')
  const [usersError, setUsersError] = useState('')
  const [usersSuccess, setUsersSuccess] = useState('')
  const [reportsError, setReportsError] = useState('')
  const [reportsSuccess, setReportsSuccess] = useState('')
  const [accessError, setAccessError] = useState('')
  const [accessSuccess, setAccessSuccess] = useState('')
  const [savingUserId, setSavingUserId] = useState(null)
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState(null)
  const [creatingUser, setCreatingUser] = useState(false)
  const [creatingReport, setCreatingReport] = useState(false)
  const [deletingReportId, setDeletingReportId] = useState(null)
  const [savingAccess, setSavingAccess] = useState(false)

  const filteredUsers = users.filter((currentUser) => {
    const query = userSearch.trim().toLowerCase()
    if (!query) return true
    return [currentUser.first_name, currentUser.last_name, currentUser.email, currentUser.role]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query))
  })

  const filteredAccessUsers = users.filter((currentUser) => {
    const query = accessSearch.trim().toLowerCase()
    if (!query) return true
    return [currentUser.first_name, currentUser.last_name, currentUser.email]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query))
  })

  const selectedUser = users.find((currentUser) => currentUser.id === selectedUserId) ?? filteredUsers[0] ?? users[0] ?? null
  const selectedAccessUser =
    users.find((currentUser) => currentUser.id === selectedAccessUserId) ?? filteredAccessUsers[0] ?? users[0] ?? null

  const assignedReportIds = new Set((selectedAccessUser?.report_access ?? []).map((report) => report.id))

  useEffect(() => {
    if (!users.length) {
      setSelectedUserId(null)
      setSelectedAccessUserId(null)
      setUserDraft(null)
      return
    }

    if (!users.some((currentUser) => currentUser.id === selectedUserId)) {
      setSelectedUserId(users[0].id)
    }

    if (!users.some((currentUser) => currentUser.id === selectedAccessUserId)) {
      setSelectedAccessUserId(users[0].id)
    }
  }, [users, selectedAccessUserId, selectedUserId])

  useEffect(() => {
    if (selectedUser) {
      setUserDraft({
        id: selectedUser.id,
        first_name: selectedUser.first_name ?? '',
        last_name: selectedUser.last_name ?? '',
        email: selectedUser.email ?? '',
        role: selectedUser.role ?? 'user'
      })
      setPasswordResetValue('')
    } else {
      setUserDraft(null)
      setPasswordResetValue('')
    }
  }, [selectedUser])

  async function createUser(event) {
    event.preventDefault()
    setUsersError('')
    setUsersSuccess('')
    setCreatingUser(true)
    try {
      await api.createUser({
        ...newUser,
        first_name: newUser.first_name.trim(),
        last_name: newUser.last_name.trim(),
        email: newUser.email.trim()
      })
      setNewUser(emptyUser)
      setShowCreateUser(false)
      setUsersSuccess('User created successfully.')
      await refreshAdmin()
    } catch (err) {
      setUsersError(err.message)
    } finally {
      setCreatingUser(false)
    }
  }

  async function saveUser() {
    if (!userDraft) return

    setUsersError('')
    setUsersSuccess('')
    setSavingUserId(userDraft.id)
    try {
      await api.updateUser(userDraft.id, {
        first_name: userDraft.first_name.trim(),
        last_name: userDraft.last_name.trim(),
        email: userDraft.email.trim(),
        role: userDraft.role
      })
      setUsersSuccess('User details saved.')
      await refreshAdmin()
    } catch (err) {
      setUsersError(err.message)
    } finally {
      setSavingUserId(null)
    }
  }

  async function resetUserPassword() {
    if (!userDraft) return

    setUsersError('')
    setUsersSuccess('')
    setResettingPasswordUserId(userDraft.id)
    try {
      await api.resetUserPassword(userDraft.id, passwordResetValue.trim())
      setUsersSuccess('Password reset. The user must change it at next login.')
      setPasswordResetValue('')
      await refreshAdmin()
    } catch (err) {
      setUsersError(err.message)
    } finally {
      setResettingPasswordUserId(null)
    }
  }

  async function createReport(event) {
    event.preventDefault()
    setReportsError('')
    setReportsSuccess('')
    setCreatingReport(true)
    try {
      await api.createReport({
        ...newReport,
        name: newReport.name.trim(),
        report_id: newReport.report_id.trim(),
        embed_url: newReport.embed_url.trim(),
        embed_token: newReport.embed_token.trim() || null,
        dataset_id: newReport.dataset_id.trim() || null,
        workspace_id: newReport.workspace_id.trim() || null
      })
      setNewReport(emptyReport)
      setShowAddReport(false)
      setReportsSuccess('Report added successfully.')
      await refreshAdmin()
    } catch (err) {
      setReportsError(err.message)
    } finally {
      setCreatingReport(false)
    }
  }

  async function deleteReport(report) {
    const confirmed = window.confirm(`Delete report "${report.name}"?`)
    if (!confirmed) return

    setReportsError('')
    setReportsSuccess('')
    setDeletingReportId(report.id)
    try {
      await api.deleteReport(report.id)
      setReportsSuccess('Report deleted.')
      await refreshAdmin()
    } catch (err) {
      setReportsError(err.message)
    } finally {
      setDeletingReportId(null)
    }
  }

  async function toggleUserAccess(reportId, checked) {
    if (!selectedAccessUser) return

    setAccessError('')
    setAccessSuccess('')
    const updated = new Set(selectedAccessUser.report_access.map((report) => report.id))
    if (checked) updated.add(reportId)
    else updated.delete(reportId)

    setSavingAccess(true)
    try {
      await api.updateUserAccess(selectedAccessUser.id, Array.from(updated))
      setAccessSuccess('Report access updated.')
      await refreshAdmin()
    } catch (err) {
      setAccessError(err.message)
    } finally {
      setSavingAccess(false)
    }
  }

  return (
    <section className="admin-workspace">
      <div className="card admin-overview">
        <div>
          <p className="section-kicker">Admin workspace</p>
          <h3>Manage users, reports, and access without leaving the page.</h3>
        </div>
        <div className="admin-stats">
          <div className="admin-stat">
            <strong>{users.length}</strong>
            <span>Users</span>
          </div>
          <div className="admin-stat">
            <strong>{reports.length}</strong>
            <span>Reports</span>
          </div>
        </div>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Admin views">
        {[
          ['users', 'Users'],
          ['reports', 'Reports'],
          ['access', 'Access']
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            className={activeTab === key ? 'admin-tab active' : 'admin-tab'}
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <section className="admin-panel-grid">
          <div className="card admin-sidebar-card">
            <div className="admin-card-header">
              <div>
                <h3>Users</h3>
                <p className="muted">Search, review, and select a user to edit.</p>
              </div>
              <button type="button" onClick={() => setShowCreateUser((current) => !current)}>
                {showCreateUser ? 'Close' : 'New User'}
              </button>
            </div>

            {showCreateUser && (
              <form onSubmit={createUser} className="stack inset-section">
                <input
                  placeholder="first name"
                  value={newUser.first_name}
                  onChange={(e) => setNewUser((current) => ({ ...current, first_name: e.target.value }))}
                  minLength={1}
                  required
                />
                <input
                  placeholder="last name"
                  value={newUser.last_name}
                  onChange={(e) => setNewUser((current) => ({ ...current, last_name: e.target.value }))}
                  minLength={1}
                  required
                />
                <input
                  type="email"
                  placeholder="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser((current) => ({ ...current, email: e.target.value }))}
                  required
                />
                <input
                  type="password"
                  placeholder="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser((current) => ({ ...current, password: e.target.value }))}
                  minLength={8}
                  required
                />
                <select value={newUser.role} onChange={(e) => setNewUser((current) => ({ ...current, role: e.target.value }))}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                {usersError && <p className="error inline-feedback">{usersError}</p>}
                <div className="form-actions">
                  <button type="submit" disabled={creatingUser}>{creatingUser ? 'Creating...' : 'Create User'}</button>
                  <button type="button" className="secondary-btn" onClick={() => setShowCreateUser(false)}>Cancel</button>
                </div>
              </form>
            )}

            <input
              type="search"
              placeholder="Search users"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />

            <div className="admin-entity-list">
              {filteredUsers.length === 0 ? (
                <p className="muted">No users match your search.</p>
              ) : (
                filteredUsers.map((currentUser) => (
                  <button
                    key={currentUser.id}
                    type="button"
                    className={selectedUser?.id === currentUser.id ? 'entity-list-item active' : 'entity-list-item'}
                    onClick={() => setSelectedUserId(currentUser.id)}
                  >
                    <strong>{formatUserName(currentUser)}</strong>
                    <span>{currentUser.email}</span>
                    <span className="entity-tag">{currentUser.role}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="card admin-detail-card">
            <div className="admin-card-header">
              <div>
                <h3>User Details</h3>
                <p className="muted">Update profile details and role for the selected user.</p>
              </div>
            </div>

            {!userDraft ? (
              <p className="muted">Select a user to edit.</p>
            ) : (
              <>
                <div className="detail-identity">
                  <h4>{formatUserName(userDraft)}</h4>
                  <span className="entity-tag">{userDraft.role}</span>
                </div>
                <div className="detail-grid">
                  <label>
                    First name
                    <input
                      value={userDraft.first_name}
                      onChange={(e) => setUserDraft((current) => ({ ...current, first_name: e.target.value }))}
                      minLength={1}
                      required
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      value={userDraft.last_name}
                      onChange={(e) => setUserDraft((current) => ({ ...current, last_name: e.target.value }))}
                      minLength={1}
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={userDraft.email}
                      onChange={(e) => setUserDraft((current) => ({ ...current, email: e.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Role
                    <select value={userDraft.role} onChange={(e) => setUserDraft((current) => ({ ...current, role: e.target.value }))}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </label>
                </div>
                <div className="detail-actions">
                  <button type="button" onClick={saveUser} disabled={savingUserId === userDraft.id}>
                    {savingUserId === userDraft.id ? 'Saving...' : 'Save Changes'}
                  </button>
                  <p className="muted">Update the profile details first, then use the password tools below if needed.</p>
                </div>
                <div className="inset-section">
                  <div className="admin-card-header">
                    <div>
                      <h4>Reset Password</h4>
                      <p className="muted">Set a new temporary password and force a password change on the next login.</p>
                    </div>
                  </div>
                  <div className="detail-grid detail-grid-tight">
                    <label>
                      Temporary password
                      <input
                        type="password"
                        value={passwordResetValue}
                        onChange={(e) => setPasswordResetValue(e.target.value)}
                        minLength={8}
                        placeholder="Minimum 8 characters"
                      />
                    </label>
                  </div>
                  <div className="detail-actions">
                    <button
                      type="button"
                      onClick={resetUserPassword}
                      disabled={!passwordResetValue.trim() || passwordResetValue.trim().length < 8 || resettingPasswordUserId === userDraft.id}
                    >
                      {resettingPasswordUserId === userDraft.id ? 'Resetting...' : 'Reset Password'}
                    </button>
                    <p className="muted">
                      {selectedUser?.must_change_password ? 'This user is already required to change their password.' : 'Password reset has not been triggered yet.'}
                    </p>
                  </div>
                </div>
                {usersError && <p className="error inline-feedback">{usersError}</p>}
                {usersSuccess && <p className="success inline-feedback">{usersSuccess}</p>}
                <p className="muted">New users are still forced to change password on first login.</p>
              </>
            )}
          </div>
        </section>
      )}

      {activeTab === 'reports' && (
        <section className="admin-panel-grid reports-layout">
          <div className="card admin-sidebar-card">
            <div className="admin-card-header">
              <div>
                <h3>Report Inventory</h3>
                <p className="muted">Review the reports currently available in the portal.</p>
              </div>
              <button type="button" onClick={() => setShowAddReport((current) => !current)}>
                {showAddReport ? 'Close' : 'Add Report'}
              </button>
            </div>

            <div className="admin-entity-list">
              {reports.length === 0 ? (
                <p className="muted">No reports have been added yet.</p>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="report-summary-card">
                    <strong>{report.name}</strong>
                    <span>Report ID: {report.report_id}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card admin-detail-card">
            {showAddReport && (
              <form onSubmit={createReport} className="stack inset-section">
                <div className="admin-card-header">
                  <div>
                    <h3>Add Report</h3>
                    <p className="muted">Leave embed token blank for public publish-to-web reports.</p>
                  </div>
                </div>
                <input
                  placeholder="name"
                  value={newReport.name}
                  onChange={(e) => setNewReport((current) => ({ ...current, name: e.target.value }))}
                  required
                />
                <input
                  placeholder="report_id"
                  value={newReport.report_id}
                  onChange={(e) => setNewReport((current) => ({ ...current, report_id: e.target.value }))}
                  required
                />
                <input
                  placeholder="embed_url"
                  value={newReport.embed_url}
                  onChange={(e) => setNewReport((current) => ({ ...current, embed_url: e.target.value }))}
                  required
                />
                <input
                  placeholder="embed_token (optional)"
                  value={newReport.embed_token}
                  onChange={(e) => setNewReport((current) => ({ ...current, embed_token: e.target.value }))}
                />
                <div className="detail-grid">
                  <label>
                    Dataset ID
                    <input
                      placeholder="optional"
                      value={newReport.dataset_id}
                      onChange={(e) => setNewReport((current) => ({ ...current, dataset_id: e.target.value }))}
                    />
                  </label>
                  <label>
                    Workspace ID
                    <input
                      placeholder="optional"
                      value={newReport.workspace_id}
                      onChange={(e) => setNewReport((current) => ({ ...current, workspace_id: e.target.value }))}
                    />
                  </label>
                </div>
                {reportsError && <p className="error inline-feedback">{reportsError}</p>}
                <div className="form-actions">
                  <button type="submit" disabled={creatingReport}>{creatingReport ? 'Adding...' : 'Add Report'}</button>
                  <button type="button" className="secondary-btn" onClick={() => setShowAddReport(false)}>Cancel</button>
                </div>
              </form>
            )}

            <div className="admin-card-header">
              <div>
                <h3>Manage Reports</h3>
                <p className="muted">Delete unused reports and keep the catalog clean.</p>
              </div>
            </div>

            {reportsSuccess && <p className="success inline-feedback">{reportsSuccess}</p>}
            {reportsError && !showAddReport && <p className="error inline-feedback">{reportsError}</p>}

            <div className="report-admin-list">
              {reports.length === 0 ? (
                <p className="muted">No reports have been added yet.</p>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="report-admin-row">
                    <div className="report-admin-meta">
                      <strong>{report.name}</strong>
                      <span className="muted">Report ID: {report.report_id}</span>
                      <span className="muted report-url">{report.embed_url}</span>
                    </div>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => deleteReport(report)}
                      disabled={deletingReportId === report.id}
                    >
                      {deletingReportId === report.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'access' && (
        <section className="admin-panel-grid">
          <div className="card admin-sidebar-card">
            <div className="admin-card-header">
              <div>
                <h3>Access</h3>
                <p className="muted">Choose one user, then manage their assigned reports.</p>
              </div>
            </div>

            <input
              type="search"
              placeholder="Search users"
              value={accessSearch}
              onChange={(e) => setAccessSearch(e.target.value)}
            />

            <div className="admin-entity-list">
              {filteredAccessUsers.length === 0 ? (
                <p className="muted">No users match your search.</p>
              ) : (
                filteredAccessUsers.map((currentUser) => (
                  <button
                    key={currentUser.id}
                    type="button"
                    className={selectedAccessUser?.id === currentUser.id ? 'entity-list-item active' : 'entity-list-item'}
                    onClick={() => setSelectedAccessUserId(currentUser.id)}
                  >
                    <strong>{formatUserName(currentUser)}</strong>
                    <span>{currentUser.email}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="card admin-detail-card">
            <div className="admin-card-header">
              <div>
                <h3>Assigned Reports</h3>
                <p className="muted">
                  {selectedAccessUser ? `Manage access for ${formatUserName(selectedAccessUser)}.` : 'Select a user to manage access.'}
                </p>
              </div>
            </div>

            {!selectedAccessUser ? (
              <p className="muted">Select a user to manage report access.</p>
            ) : reports.length === 0 ? (
              <p className="muted">Add reports first before assigning access.</p>
            ) : (
              <>
                <div className="assigned-report-summary">
                  <span className="entity-tag">{selectedAccessUser.role}</span>
                  <p className="muted">
                    {assignedReportIds.size} of {reports.length} reports assigned
                  </p>
                </div>
                {accessError && <p className="error inline-feedback">{accessError}</p>}
                {accessSuccess && <p className="success inline-feedback">{accessSuccess}</p>}
                <div className="access-checklist">
                  {reports.map((report) => {
                    const checked = assignedReportIds.has(report.id)
                    return (
                      <label key={`${selectedAccessUser.id}-${report.id}`} className={checked ? 'access-item active' : 'access-item'}>
                        <div>
                          <strong>{report.name}</strong>
                          <span>Report ID: {report.report_id}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={savingAccess}
                          onChange={(e) => toggleUserAccess(report.id, e.target.checked)}
                        />
                      </label>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </section>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [reports, setReports] = useState([])
  const [users, setUsers] = useState([])
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(getPageFromLocation)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function loadAuthenticatedApp(currentUser) {
    setError('')
    if (currentUser.must_change_password) {
      setReports([])
      setUsers([])
      setSelectedReportId(null)
      return
    }

    await refreshReports()
    if (currentUser.role === 'admin') {
      const data = await api.adminUsers()
      setUsers(data.users)
    } else {
      setUsers([])
    }
  }

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
        await loadAuthenticatedApp(me.user)
      } catch {
        setUser(null)
      }
    }
    bootstrap()
  }, [])

  useEffect(() => {
    function syncPage() {
      setPage(getPageFromLocation())
    }

    window.addEventListener('hashchange', syncPage)
    syncPage()

    return () => window.removeEventListener('hashchange', syncPage)
  }, [])

  useEffect(() => {
    if (page === 'admin' && user?.role !== 'admin') {
      navigateTo('reports')
    }
  }, [page, user])

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
      try {
        await loadAuthenticatedApp(loggedInUser)
      } catch (err) {
        setError(err.message)
      }
    }} />
  }

  if (user.must_change_password) {
    return (
      <PasswordChangeGate
        user={user}
        onLogout={logout}
        onPasswordChanged={async (updatedUser) => {
          setUser(updatedUser)
          try {
            await loadAuthenticatedApp(updatedUser)
          } catch (err) {
            setError(err.message)
          }
        }}
      />
    )
  }

  const selectedReport = reports.find((r) => r.id === selectedReportId) || null
  const isAdminPage = page === 'admin' && user.role === 'admin'
  const welcomeName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()

  return (
    <main className="layout">
      <header className="topbar card">
        <div className="topbar-brand">
          <img src={logoSrc} alt="LPG Shared Reports" className="app-logo header-logo" />
          <div>
          <h1>LPG Shared Reports</h1>
          <p className="muted">
            Welcome {welcomeName || user.email}
          </p>
          </div>
        </div>
        <div className="topbar-actions">
          <nav className="page-nav" aria-label="Primary">
            <button
              className={isAdminPage ? 'nav-btn' : 'nav-btn active'}
              onClick={() => navigateTo('reports')}
              type="button"
            >
              Reports
            </button>
            {user.role === 'admin' && (
              <button
                className={isAdminPage ? 'nav-btn active' : 'nav-btn'}
                onClick={() => navigateTo('admin')}
                type="button"
              >
                Admin
              </button>
            )}
          </nav>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {isAdminPage ? (
        <section className="page-section">
          <div className="card page-header">
            <h2>Admin</h2>
            <p className="muted">Manage users, reports, and report access separately from the main viewing experience.</p>
          </div>
          <AdminPanel reports={reports} users={users} refreshAdmin={refreshAdmin} />
        </section>
      ) : (
        <section className={sidebarOpen ? 'content-grid sidebar-open' : 'content-grid sidebar-closed'}>
          <aside className={sidebarOpen ? 'card report-list' : 'card report-list collapsed'}>
            <div className="report-list-header">
              <h2>Reports</h2>
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setSidebarOpen((open) => !open)}
                aria-expanded={sidebarOpen}
                aria-label={sidebarOpen ? 'Collapse report list' : 'Expand report list'}
              >
                {sidebarOpen ? 'Hide' : 'Show'}
              </button>
            </div>
            {sidebarOpen && (
              <>
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
              </>
            )}
          </aside>

          <section className="card embed-area">
            <div className="embed-header">
              <div>
                <p className="section-kicker">Shared report</p>
                <h2>{selectedReport ? selectedReport.name : 'Embedded Report'}</h2>
              </div>
            </div>
            <ReportEmbed report={selectedReport} />
          </section>
        </section>
      )}
    </main>
  )
}
