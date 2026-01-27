import React from 'react'
import { api } from '../api.js'

export default function Login({ onAuthed }) {
  const [mode, setMode] = React.useState('login')
  const [email, setEmail] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'register') {
        await api('/api/auth/register', { method: 'POST', body: { email, username, password } })
      }
      await api('/api/auth/login', { method: 'POST', body: { email, password } })
      await onAuthed?.()
    } catch (err) {
      setError(err.message || 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="split">
        <h2>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
        <div className="tabs">
          <button className={'tab ' + (mode==='login'?'active':'')} onClick={() => setMode('login')}>Login</button>
          <button className={'tab ' + (mode==='register'?'active':'')} onClick={() => setMode('register')}>Registro</button>
        </div>
      </div>

      <form onSubmit={submit}>
        <label>Email</label>
        <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" required />

        {mode === 'register' && (
          <>
            <label>Usuario (opcional)</label>
            <input className="input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="alex" />
          </>
        )}

        <label>Contraseña</label>
        <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />

        {error && <p style={{color:'var(--danger)'}}>{error}</p>}

        <div className="row" style={{marginTop:12}}>
          <button className="btn" disabled={busy}>{busy ? '...' : (mode === 'login' ? 'Entrar' : 'Crear y entrar')}</button>
        </div>
      </form>
    </div>
  )
}
