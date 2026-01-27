import React from 'react'
import { api } from '../api.js'

export default function Login({ onAuthed }) {
  const [mode, setMode] = React.useState('login')
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
        await api('/api/auth/register', { method: 'POST', body: { username, password } })
      }
      await api('/api/auth/login', { method: 'POST', body: { username, password } })
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
        <label>Usuario</label>
        <input className="input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="alex" required />

        <label>Contraseña</label>
        <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />

        {error && <p style={{color:'var(--danger)'}}>{error}</p>}

        <div className="row" style={{marginTop:12}}>
          <button className="btn" disabled={busy}>{busy ? '...' : (mode === 'login' ? 'Entrar' : 'Crear y entrar')}</button>
        </div>

        <p className="small" style={{marginTop:10}}>
          Nota: el sistema ya no usa email. Solo <b>usuario + contraseña</b>.
        </p>
      </form>
    </div>
  )
}
