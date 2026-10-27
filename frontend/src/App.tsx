import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type User = { id: number; email: string; role: 'user' | 'admin'; created_at: string }
type AccessRequest = {
  id: number; requester_email: string; system_name: string; reason: string;
  duration_days: number; status: 'pending' | 'approved' | 'rejected';
  decision_note?: string | null; created_at: string; updated_at: string;
}
type AuditEvent = { id: number; actor_email?: string | null; action: string; object_type: string; object_id?: string | null; details: string; created_at: string }
type ApiError = { error?: string }
type View = 'overview' | 'audit'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '')
const templates = [
  { name: 'Staging review', system: 'Staging dashboard', reason: 'Validate a release and review CI logs.' },
  { name: 'Incident response', system: 'Production logs', reason: 'Investigate and document an active incident.' },
  { name: 'Data analysis', system: 'Analytics workspace', reason: 'Complete an approved analysis for the team.' },
]

async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const payload = await response.json().catch(() => ({})) as T & ApiError
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function initials(email: string) {
  return email.slice(0, 1).toUpperCase()
}

function StatusIcon({ status }: { status: AccessRequest['status'] }) {
  return <span className={`status-dot ${status}`} aria-hidden="true" />
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
  const [view, setView] = useState<View>('overview')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | AccessRequest['status']>('all')
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to continue.') }
    finally { setBusy(false) }
  }

  async function submitRequest(event: FormEvent) {
    event.preventDefault(); if (!token) return
    setError(''); setNotice(''); setBusy(true)
    try {
      await api('/requests', token, { method: 'POST', body: JSON.stringify({ system_name: systemName, reason, duration_days: durationDays }) })
      setSystemName(''); setReason(''); setDurationDays(7)
      if (user) await refresh(token, user)
      setNotice('Request submitted. Your reviewer has been notified.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to submit request.') }
    finally { setBusy(false) }
  }

  async function decide(id: number, decision: 'approved' | 'rejected') {
    if (!token || !user) return
    setError(''); setNotice(''); setBusy(true)
    try {
      await api(`/admin/requests/${id}/decision`, token, { method: 'POST', body: JSON.stringify({ decision, note: decisionNotes[id] || '' }) })
      await refresh(token, user)
      setNotice(`Request REQ-${String(id).padStart(4, '0')} ${decision}.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update request.') }
    finally { setBusy(false) }
  }

  function logout() {
    sessionStorage.removeItem('gatekeeper_token'); setToken(''); setUser(null); setRequests([]); setEvents([])
  }

  const passwordScore = [password.length >= 12, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length
  const pending = requests.filter(item => item.status === 'pending').length
  const approved = requests.filter(item => item.status === 'approved').length
  const visibleRequests = useMemo(() => requests.filter(item => {
    const matchesFilter = filter === 'all' || item.status === filter
    const haystack = `${item.system_name} ${item.reason} ${item.requester_email}`.toLowerCase()
    return matchesFilter && haystack.includes(query.toLowerCase())
  }), [filter, query, requests])

  if (!token || !user) {
    return <main className="auth-shell">
      <section className="auth-pitch">
        <div className="brand"><div className="brand-mark">G</div><div><strong>Gatekeeper</strong><span>Access governance, made clear.</span></div></div>
        <div className="pitch-copy"><p className="eyebrow">THE ACCESS CONTROL HUB</p><h1>Make every permission <em>intentional.</em></h1><p>One calm workspace for requesting, reviewing and proving who has access to what.</p></div>
        <div className="pitch-points"><span><b>01</b> Least privilege by default</span><span><b>02</b> Decisions with context</span><span><b>03</b> An audit trail you can trust</span></div>
      </section>
      <section className="auth-card">
        <p className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</p><h2>{mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}</h2><p className="muted">{mode === 'login' ? 'Continue managing access with confidence.' : 'Join your team\'s accountable access workflow.'}</p>
        <div className="tabs"><button className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => { setMode('login'); setError('') }}>Sign in</button><button className={mode === 'register' ? 'tab active' : 'tab'} onClick={() => { setMode('register'); setError('') }}>Create account</button></div>
        <form onSubmit={submitAuth} className="stack-form">
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'register' ? 'At least 12 characters' : 'Your password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 12 : 1} required />{mode === 'register' && <><div className="strength"><span className={`strength-bar score-${passwordScore}`} /><span>{passwordScore < 2 ? 'Build a stronger password' : passwordScore < 4 ? 'Good start' : 'Strong password'}</span></div></>}</label>
          <button className="primary full" disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Enter workspace' : 'Create account'} <span aria-hidden="true">→</span></button>
        </form>
        {error && <p className="alert error">{error}</p>}
        <p className="fine-print">Public accounts start with regular-user access. Administrators are provisioned separately to protect your workspace.</p>
      </section>
    </main>
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark small">G</div><div><strong>Gatekeeper</strong><span>Access governance</span></div></div><nav className="main-nav"><button className={view === 'overview' ? 'nav-link active' : 'nav-link'} onClick={() => setView('overview')}>Overview</button>{user.role === 'admin' && <button className={view === 'audit' ? 'nav-link active' : 'nav-link'} onClick={() => setView('audit')}>Audit trail <span>{events.length}</span></button>}</nav><div className="topbar-right"><div className="avatar">{initials(user.email)}</div><div className="identity"><strong>{user.email.split('@')[0]}</strong><span>{user.role === 'admin' ? 'Workspace administrator' : 'Member'}</span></div><button className="secondary" onClick={logout}>Sign out</button></div></header>
    <section className="hero"><div><p className="eyebrow">{user.role === 'admin' ? 'REVIEW WORKSPACE' : 'YOUR ACCESS WORKSPACE'}</p><h1>{user.role === 'admin' ? 'Keep access moving.' : 'Access, with accountability.'}</h1><p>{user.role === 'admin' ? 'Review requests with the context you need, and leave a clear trail behind.' : 'Request only what you need, for only as long as you need it.'}</p></div><div className="hero-stats"><div><span>{requests.length}</span><small>{user.role === 'admin' ? 'Total requests' : 'My requests'}</small></div><div className="stat-highlight"><span>{pending}</span><small>Needs attention</small></div><div><span>{approved}</span><small>Approved</small></div></div></section>
    {error && <p className="alert error">{error}</p>}{notice && <p className="alert success">{notice}</p>}
    {view === 'overview' ? <><div className="content-grid">
      <section className="panel request-form-panel"><div className="panel-heading"><div><p className="eyebrow">NEW REQUEST</p><h2>Ask for access</h2></div><span className="step-tag">01 / 02</span></div><p className="panel-intro">Tell a reviewer what you need and why. Specific context helps decisions happen faster.</p>
        <div className="template-row"><span>Start with a template</span>{templates.map(template => <button key={template.name} className="template" onClick={() => { setSystemName(template.system); setReason(template.reason) }}>{template.name}</button>)}</div>
        <form className="stack-form" onSubmit={submitRequest}><label>System or resource<input value={systemName} onChange={e => setSystemName(e.target.value)} placeholder="e.g. Staging dashboard" maxLength={100} required /></label><label>Business reason<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="What task does this access support?" rows={4} maxLength={1000} required /><small className="char-count">{reason.length}/1000</small></label><div className="duration-row"><label>Access duration<select value={durationDays} onChange={e => setDurationDays(Number(e.target.value))}>{[1,3,7,14,30,60,90].map(n => <option key={n} value={n}>{n} day{n > 1 ? 's' : ''}</option>)}</select></label><div className="expiry-note"><span>◷</span><p>Expires automatically<br /><strong>{new Date(Date.now() + durationDays * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong></p></div></div><button className="primary" disabled={busy}>Submit for approval <span aria-hidden="true">→</span></button></form>
      </section>
      <section className="panel requests-panel"><div className="panel-heading"><div><p className="eyebrow">WORK QUEUE</p><h2>{user.role === 'admin' ? 'Requests to review' : 'Your requests'}</h2></div><span className="count-pill">{visibleRequests.length} shown</span></div><div className="list-tools"><label className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search requests..." /></label><select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} aria-label="Filter requests"><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
        {visibleRequests.length === 0 ? <div className="empty"><span>✓</span><strong>{requests.length ? 'No matching requests' : 'Your queue is clear'}</strong><p>{requests.length ? 'Try another search or status filter.' : 'New access requests will appear here.'}</p></div> : <div className="request-list">{visibleRequests.map(item => <article className="request-card" key={item.id}><div className="request-top"><div className="request-title"><span className="request-id"><StatusIcon status={item.status} />REQ-{String(item.id).padStart(4, '0')}</span><h3>{item.system_name}</h3></div><span className={`status ${item.status}`}>{item.status}</span></div><p className="reason">{item.reason}</p><div className="meta"><span>{user.role === 'admin' ? item.requester_email : 'Submitted by you'}</span><span>{item.duration_days} days</span><span>{formatDate(item.created_at)}</span></div>{item.decision_note && <p className="decision-note"><b>Reviewer note</b> {item.decision_note}</p>}{user.role === 'admin' && item.status === 'pending' && <div className="review-controls"><input aria-label={`Review note for request ${item.id}`} placeholder="Add a note (optional)" value={decisionNotes[item.id] || ''} onChange={e => setDecisionNotes(prev => ({ ...prev, [item.id]: e.target.value }))} /><button disabled={busy} className="approve" onClick={() => decide(item.id, 'approved')}>Approve</button><button disabled={busy} className="reject" onClick={() => decide(item.id, 'rejected')}>Reject</button></div>}</article>)}</div>}
      </section>
    </div><section className="principles"><div><span className="principle-icon">◈</span><div><strong>Least privilege</strong><p>Short-lived access keeps your risk surface small.</p></div></div><div><span className="principle-icon">◎</span><div><strong>Human decisions</strong><p>Every approval has a person and a reason behind it.</p></div></div><div><span className="principle-icon">↗</span><div><strong>Always traceable</strong><p>Review the complete story whenever you need it.</p></div></div></section></> : <section className="panel audit-page"><div className="panel-heading"><div><p className="eyebrow">TRACEABILITY</p><h2>Audit trail</h2><p className="panel-intro">A chronological record of account and access decisions.</p></div><span className="count-pill">{events.length} events</span></div>{events.length === 0 ? <div className="empty"><span>◎</span><strong>No events recorded yet</strong><p>Activity will appear as your workspace is used.</p></div> : <div className="audit-timeline">{events.map(event => <article className="timeline-item" key={event.id}><span className="timeline-dot" /><div><div className="timeline-meta"><code>{event.action}</code><span>{new Date(event.created_at).toLocaleString()}</span></div><strong>{event.actor_email || 'System'}</strong><p>{event.details} <span className="object-ref">{event.object_type}{event.object_id ? ` #${event.object_id}` : ''}</span></p></div></article>)}</div>}</section>}
    <footer>Gatekeeper <span>·</span> Built for accountable access <span>·</span> {user.role === 'admin' ? 'Administrator workspace' : 'Member workspace'}</footer>
  </main>
}
