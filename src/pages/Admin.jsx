import React from 'react'
import { api } from '../api.js'

export default function Admin({ me }) {
  const [users, setUsers] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const [newUsername, setNewUsername] = React.useState('')
  const [newRole, setNewRole] = React.useState('counterparty')
  const [newPassword, setNewPassword] = React.useState('')
  const [createdCreds, setCreatedCreds] = React.useState(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const d = await api('/api/admin/users')
      setUsers(d.users || [])
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

  if (!me || me.role !== 'admin') {
    return <div className="card"><p style={{color:'var(--danger)'}}>Solo ADMIN.</p></div>
  }

  return (
    <div className="card">
      <div className="split">
        <div>
          <h2>Panel ADMIN</h2>
          <p className="small">Gestiona usuarios. El registro público está deshabilitado.</p>
        </div>
        <button className="btn secondary" onClick={load}>Actualizar</button>
      </div>

      {error && <p style={{color:'var(--danger)'}}>{error}</p>}

      <div className="hr"></div>

      <h2>Crear usuario</h2>
      <form onSubmit={createUser} className="grid" style={{gap:12}}>
        <div>
          <label>Usuario</label>
          <input className="input" value={newUsername} onChange={e=>setNewUsername(e.target.value)} placeholder="ariana" required />
        </div>
        <div>
          <label>Rol</label>
          <select className="input" value={newRole} onChange={e=>setNewRole(e.target.value)}>
            <option value="counterparty">counterparty</option>
            <option value="user">user</option>
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
    </div>
  )
}
