import React from 'react'
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { api } from './api.js'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import DebtDetail from './pages/DebtDetail.jsx'
import Admin from './pages/Admin.jsx'

function useMe() {
  const [me, setMe] = React.useState(null)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await api('/api/auth/me')
      setMe(data.user)
    } catch {
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { refresh() }, [refresh])
  return { me, loading, refresh }
}

export default function App() {
  const { me, loading, refresh } = useMe()
  const nav = useNavigate()

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }) } catch {}
    await refresh()
    nav('/login')
  }

  if (loading) {
    return <div className="container"><div className="card"><p>Cargando...</p></div></div>
  }

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <span style={{display:'inline-flex', width:28, height:28, borderRadius:10, border:'1px solid var(--line)', alignItems:'center', justifyContent:'center'}}>D</span>
          <span>Deuda App</span>
          <span className="pill">multiusuario</span>
        </div>
        <div className="row" style={{alignItems:'center'}}>
          <Link className="btn secondary" to="/">Inicio</Link>
          {me?.role === 'admin' && <Link className="btn secondary" to="/admin">Admin</Link>}
          {me ? (
            <>
              <span className="pill">👤 {me.username} {me.role === 'admin' ? '· ADMIN' : ''}</span>
              <button className="btn secondary" onClick={logout}>Salir</button>
            </>
          ) : (
            <Link className="btn" to="/login">Entrar</Link>
          )}
        </div>
      </div>

      <Routes>
        <Route path="/login" element={me ? <Navigate to="/" /> : <Login onAuthed={refresh} />} />
        <Route path="/" element={me ? <Dashboard me={me} /> : <Navigate to="/login" />} />
        <Route path="/debts/:id" element={me ? <DebtDetail me={me} /> : <Navigate to="/login" />} />
        <Route path="/admin" element={me ? <Admin me={me} /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <div style={{marginTop:16}} className="small">
        Tip: en iPhone, abre la web en Safari → Share → <b>Add to Home Screen</b>.
      </div>
    </div>
  )
}
