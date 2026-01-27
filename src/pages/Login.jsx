import React from 'react'
import { api } from '../api.js'

export default function Login({ onAuthed }) {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
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
        <h2>Iniciar sesión</h2>
        <div className="small">Solo <b>usuario + contraseña</b></div>
      </div>

      <form onSubmit={submit}>
        <label>Usuario</label>
        <input className="input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="alex" required />

        <label>Contraseña</label>
        <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />

        {error && <p style={{color:'var(--danger)'}}>{error}</p>}

        <div className="row" style={{marginTop:12}}>
          <button className="btn" disabled={busy}>{busy ? '...' : 'Entrar'}</button>
        </div>

        <p className="small" style={{marginTop:10}}>
          El registro público está deshabilitado. Si necesitas cuenta, el <b>ADMIN</b> la crea.
        </p>
      </form>
    </div>
  )
}
