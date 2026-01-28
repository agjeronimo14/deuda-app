import React from 'react'
import { api } from '../api.js'
import { Link } from 'react-router-dom'

function money(cents, currency='USD') {
  const value = (cents || 0) / 100
  return new Intl.NumberFormat('en-US', { style:'currency', currency }).format(value)
}

export default function Admin({ me }) {
  const [users, setUsers] = React.useState([])
  const [debts, setDebts] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const [newUsername, setNewUsername] = React.useState('')
  const [newRole, setNewRole] = React.useState('user')
  const [newPassword, setNewPassword] = React.useState('')
  const [createdCreds, setCreatedCreds] = React.useState(null)

  const [q, setQ] = React.useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const u = await api('/api/admin/users')
      setUsers(u.users || [])
      const d = await api('/api/admin/debts')
      setDebts(d.debts || [])
    } catch (e) {
      setError(e.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { load() }, [])

  async function createUser(e){
    e.preventDefault()
    setError(''); setCreatedCreds(null)
    try{
      const d = await api('/api/admin/users', { method:'POST', body:{ username:newUsername, role:newRole, password: newPassword || undefined } })
      setCreatedCreds({ username: d.username, temp_password: d.temp_password, role: d.role })
      setNewUsername(''); setNewPassword('')
      await load()
    }catch(e){
      setError(e.message || 'Error')
    }
  }

  async function resetPassword(id){
    if(!confirm('¿Resetear contraseña? (se generará una nueva)')) return
    setError('')
    try{
      const d = await api(`/api/admin/users/${id}/reset-password`, { method:'POST', body:{} })
      alert(`Nueva contraseña para user #${id}: ${d.temp_password}`)
      await load()
    }catch(e){ setError(e.message || 'Error') }
  }

  async function toggleActive(u){
    if(!confirm(`${u.is_active ? 'Desactivar' : 'Activar'} usuario ${u.username}?`)) return
    setError('')
    try{
      await api(`/api/admin/users/${u.id}/set-active`, { method:'POST', body:{ is_active: !u.is_active } })
      await load()
    }catch(e){ setError(e.message || 'Error') }
  }

  async function deleteDebt(id){
    if(!confirm('¿Eliminar deuda (y abonos)?')) return
    setError('')
    try{
      await api(`/api/debts/${id}`, { method:'DELETE' })
      await load()
    }catch(e){ setError(e.message || 'Error') }
  }

  async function cleanup(scope){
    const ok = prompt(`Escribe DELETE para limpiar: ${scope}`) === 'DELETE'
    if(!ok) return
    setError('')
    try{
      await api('/api/admin/cleanup', { method:'POST', body:{ confirm:'DELETE', scope } })
      await load()
    }catch(e){ setError(e.message || 'Error') }
  }

  if (!me || me.role !== 'admin') {
    return <div className="card"><p style={{color:'var(--danger)'}}>Solo ADMIN.</p></div>
  }

  const filteredDebts = debts.filter(d => {
    const s = `${d.id} ${d.title} ${d.owner_username} ${d.counterparty_username||''} ${d.direction}`.toLowerCase()
    return s.includes(q.toLowerCase())
  })

  return (
    <div className="card">
      <div className="split">
        <div>
          <h2>Panel ADMIN</h2>
          <p className="small">El registro público está deshabilitado: SOLO ADMIN crea usuarios.</p>
        </div>
        <button className="btn secondary" onClick={load}>Actualizar</button>
      </div>

      {error && <p style={{color:'var(--danger)'}}>{error}</p>}

      <div className="hr"></div>

      <h2>Crear usuario</h2>
      <form onSubmit={createUser} className="grid" style={{gap:12}}>
        <div>
          <label>Usuario</label>
          <input className="input" value={newUsername} onChange={e=>setNewUsername(e.target.value)} placeholder="alex" required />
        </div>
        <div>
          <label>Rol</label>
          <select className="input" value={newRole} onChange={e=>setNewRole(e.target.value)}>
            <option value="user">user</option>
            <option value="counterparty">counterparty</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div>
          <label>Contraseña (opcional)</label>
          <input className="input" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="(si vacío, se genera)" />
        </div>
        <div style={{display:'flex', alignItems:'end'}}>
          <button className="btn ok" type="submit">Crear</button>
        </div>
      </form>

      {createdCreds && (
        <div className="card" style={{padding:12, marginTop:12}}>
          <p><b>✅ Usuario creado</b></p>
          <p className="small">Usuario: <b>{createdCreds.username}</b></p>
          <p className="small">Contraseña: <b>{createdCreds.temp_password}</b></p>
          <p className="small">Rol: {createdCreds.role}</p>
          <p className="small">Cópialo y envíaselo a la persona.</p>
        </div>
      )}

      <div className="hr"></div>

      <h2>Usuarios</h2>
      {loading ? <p>Cargando...</p> : (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Activo</th>
              <th>Creado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan="6" className="small">No hay usuarios.</td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td className="small">{u.id}</td>
                <td><b>{u.username}</b></td>
                <td className="small">{u.role}</td>
                <td className="small">{u.is_active ? '✅' : '⛔'}</td>
                <td className="small">{(u.created_at || '').slice(0,10)}</td>
                <td>
                  {u.role !== 'admin' && (
                    <div className="row">
                      <button className="btn secondary" onClick={()=>resetPassword(u.id)}>Reset pass</button>
                      <button className="btn danger" onClick={()=>toggleActive(u)}>{u.is_active ? 'Desactivar' : 'Activar'}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="hr"></div>

      <div className="split">
        <div>
          <h2>Deudas (global)</h2>
          <p className="small">Puedes abrir, editar o eliminar.</p>
        </div>
        <div className="row">
          <input className="input" style={{width:220}} value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar..." />
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Título</th>
            <th>Owner</th>
            <th>Contraparte</th>
            <th>Saldo</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredDebts.length === 0 ? (
            <tr><td colSpan="7" className="small">No hay deudas.</td></tr>
          ) : filteredDebts.map(d => (
            <tr key={d.id}>
              <td className="small">{d.id}</td>
              <td>
                <b>{d.title}</b>
                <div className="small">{d.direction === 'I_OWE' ? 'Yo debo' : 'Me deben'}</div>
              </td>
              <td className="small">{d.owner_username}</td>
              <td className="small">{d.counterparty_username || '—'}</td>
              <td><b>{money(d.balance_cents, d.currency)}</b></td>
              <td className="small">{d.due_date || '—'}</td>
              <td>
                <div className="row">
                  <Link className="btn secondary" to={`/debts/${d.id}`}>Abrir</Link>
                  <button className="btn danger" onClick={()=>deleteDebt(d.id)}>Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="hr"></div>

      <h2>Limpieza (peligroso)</h2>
      <p className="small">Esto borra datos para “resetear” la DB. Se te pedirá escribir DELETE.</p>
      <div className="row">
        <button className="btn danger" onClick={()=>cleanup('SESSIONS')}>Borrar sesiones</button>
        <button className="btn danger" onClick={()=>cleanup('PAYMENTS')}>Borrar abonos</button>
        <button className="btn danger" onClick={()=>cleanup('DEBTS')}>Borrar deudas+abonos</button>
        <button className="btn danger" onClick={()=>cleanup('ALL')}>Borrar TODO (excepto users)</button>
      </div>
    </div>
  )
}
