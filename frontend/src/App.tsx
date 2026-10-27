import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type User = { id: number; email: string; role: 'user' | 'admin'; created_at: string }
type AccessRequest = {
  id: number; requester_email: string; system_name: string; reason: string;
  duration_days: number; status: 'pending' | 'approved' | 'rejected';
  decision_note?: string | null; created_at: string; updated_at: string;
}
type AuditEvent = { id: number; actor_email?: string | null; action: string; object_type: string; object_id?: string | null; details: string; created_at: string }
type ApiError = { error?: string }
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '')

async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const payload = await response.json().catch(() => ({})) as T & ApiError
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('gatekeeper_token') || '')
  const [user, setUser] = useState<User | null>(null)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [systemName, setSystemName] = useState('')
  const [reason, setReason] = useState('')
  const [durationDays, setDurationDays] = useState(7)
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [decisionNotes, setDecisionNotes] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async (activeToken: string, activeUser: User) => {
    const requestData = await api<{ requests: AccessRequest[] }>('/requests', activeToken)
    setRequests(requestData.requests)
    if (activeUser.role === 'admin') {
      const eventData = await api<{ events: AuditEvent[] }>('/admin/audit-events', activeToken)
      setEvents(eventData.events)
    } else setEvents([])
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!token) { setUser(null); setRequests([]); setEvents([]); return }
    api<{ user: User }>('/auth/me', token)
      .then(async data => {
        if (cancelled) return
        setUser(data.user)
        await refresh(token, data.user)
      })
      .catch(() => {
        if (!cancelled) {
          sessionStorage.removeItem('gatekeeper_token')
          setToken('')
          setUser(null)
        }
      })
    return () => { cancelled = true }
  }, [token, refresh])

  async function submitAuth(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true)
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const data = await api<{ access_token: string; user: User }>(path, undefined, {
        method: 'POST', body: JSON.stringify({ email, password }),
      })
      sessionStorage.setItem('gatekeeper_token', data.access_token)
      setUser(data.user); setToken(data.access_token); setPassword('')
      setNotice(`Signed in as ${data.user.role}.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in.') }
    finally { setBusy(false) }
  }

  async function submitRequest(event: FormEvent) {
    event.preventDefault(); if (!token) return
    setError(''); setNotice(''); setBusy(true)
    try {
      await api('/requests', token, { method: 'POST', body: JSON.stringify({ system_name: systemName, reason, duration_days: durationDays }) })
      setSystemName(''); setReason(''); setDurationDays(7)
      if (user) await refresh(token, user)
      setNotice('Access request submitted for review.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to submit request.') }
    finally { setBusy(false) }
  }

  async function decide(id: number, decision: 'approved' | 'rejected') {
    if (!token || !user) return
    setError(''); setNotice(''); setBusy(true)
    try {
      await api(`/admin/requests/${id}/decision`, token, { method: 'POST', body: JSON.stringify({ decision, note: decisionNotes[id] || '' }) })
      await refresh(token, user)
      setNotice(`Request #${id} ${decision}.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update request.') }
    finally { setBusy(false) }
  }

  function logout() {
    sessionStorage.removeItem('gatekeeper_token'); setToken(''); setUser(null); setRequests([]); setEvents([]); setNotice('Signed out.')
  }

  if (!token || !user) {
    return <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">G</div>
        <p className="eyebrow">ACCESS GOVERNANCE DEMO</p>
        <h1>Gatekeeper</h1>
        <p className="muted">Make access requests traceable, reviewable and accountable.</p>
        <div className="tabs"><button className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => setMode('login')}>Sign in</button><button className={mode === 'register' ? 'tab active' : 'tab'} onClick={() => setMode('register')}>Create account</button></div>
        <form onSubmit={submitAuth} className="stack-form">
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 12 : 1} required />{mode === 'register' && <small>Use at least 12 characters.</small>}</label>
          <button className="primary full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        {error && <p className="alert error">{error}</p>}{notice && <p className="alert success">{notice}</p>}
        <p className="fine-print">Demo project. Create an administrator through the backend setup instructions; public registration can only create regular users.</p>
      </section>
    </main>
  }

  const pending = requests.filter(item => item.status === 'pending').length
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark small">G</div><div><strong>Gatekeeper</strong><span>Access governance</span></div></div><div className="topbar-right"><span className="role-pill">{user.role}</span><span className="user-email">{user.email}</span><button className="secondary" onClick={logout}>Sign out</button></div></header>
    <section className="hero"><div><p className="eyebrow">CONTROLLED ACCESS WORKFLOW</p><h1>Access, with accountability.</h1><p>Request the minimum access you need. Reviewers make decisions with an auditable trail.</p></div><div className="hero-stats"><div><span>{requests.length}</span><small>{user.role === 'admin' ? 'Total requests' : 'Your requests'}</small></div><div><span>{pending}</span><small>Pending review</small></div></div></section>
    {error && <p className="alert error">{error}</p>}{notice && <p className="alert success">{notice}</p>}
    <div className="content-grid">
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">NEW REQUEST</p><h2>Request system access</h2></div><span className="step-tag">01 / Submit</span></div>
        <form className="stack-form" onSubmit={submitRequest}>
          <label>System or resource<input value={systemName} onChange={e => setSystemName(e.target.value)} placeholder="e.g. Staging dashboard" maxLength={100} required /></label>
          <label>Business reason<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain the task this access supports…" rows={4} maxLength={1000} required /></label>
          <label>Requested duration<select value={durationDays} onChange={e => setDurationDays(Number(e.target.value))}>{[1,3,7,14,30,60,90].map(n => <option key={n} value={n}>{n} day{n > 1 ? 's' : ''}</option>)}</select></label>
          <button className="primary" disabled={busy}>Submit for approval <span aria-hidden="true">→</span></button>
        </form><p className="fine-print">Access is only a request until an authorised reviewer makes a decision.</p>
      </section>
      <section className="panel requests-panel"><div className="panel-heading"><div><p className="eyebrow">WORK QUEUE</p><h2>{user.role === 'admin' ? 'Requests to review' : 'Your requests'}</h2></div><span className="count-pill">{requests.length}</span></div>
        {requests.length === 0 ? <div className="empty"><span>↗</span><strong>No requests yet</strong><p>Submitted access requests will appear here.</p></div> : <div className="request-list">{requests.map(item => <article className="request-card" key={item.id}><div className="request-top"><div><span className="request-id">REQ-{String(item.id).padStart(4, '0')}</span><h3>{item.system_name}</h3></div><span className={`status ${item.status}`}>{item.status}</span></div><p className="reason">{item.reason}</p><div className="meta"><span>{item.requester_email}</span><span>{item.duration_days} days</span><span>{new Date(item.created_at).toLocaleDateString()}</span></div>{item.decision_note && <p className="decision-note">Reviewer note: {item.decision_note}</p>}
          {user.role === 'admin' && item.status === 'pending' && <div className="review-controls"><input aria-label={`Review note for request ${item.id}`} placeholder="Optional reviewer note" value={decisionNotes[item.id] || ''} onChange={e => setDecisionNotes(prev => ({ ...prev, [item.id]: e.target.value }))} /><button disabled={busy} className="approve" onClick={() => decide(item.id, 'approved')}>Approve</button><button disabled={busy} className="reject" onClick={() => decide(item.id, 'rejected')}>Reject</button></div>}</article>)}</div>}
      </section>
    </div>
    {user.role === 'admin' && <section className="panel audit-panel"><div className="panel-heading"><div><p className="eyebrow">TRACEABILITY</p><h2>Audit events</h2></div><span className="count-pill">{events.length}</span></div>{events.length === 0 ? <p className="muted">No events recorded yet.</p> : <div className="table-wrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Object</th><th>Details</th></tr></thead><tbody>{events.map(event => <tr key={event.id}><td>{new Date(event.created_at).toLocaleString()}</td><td>{event.actor_email || 'System'}</td><td><code>{event.action}</code></td><td>{event.object_type} {event.object_id ? `#${event.object_id}` : ''}</td><td>{event.details}</td></tr>)}</tbody></table></div>}</section>}
    <footer>Gatekeeper · Student portfolio project · Least privilege · Auditable decisions</footer>
  </main>
}
