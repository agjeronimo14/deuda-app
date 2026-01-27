import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export default function InviteAccept() {
  const { token } = useParams()
  const nav = useNavigate()
  const [state, setState] = React.useState({ loading: true, error: '', ok: false, debtId: null })

  React.useEffect(() => {
    (async () => {
      try {
        const data = await api('/api/invites/accept', { method:'POST', body: { token } })
        setState({ loading:false, error:'', ok:true, debtId: data.debt_id })
      } catch(e) {
        setState({ loading:false, error: e.message || 'Error', ok:false, debtId:null })
      }
    })()
  }, [token])

  return (
    <div className="card">
      <h2>Aceptar invitación</h2>
      {state.loading && <p>Procesando...</p>}
      {state.error && <p style={{color:'var(--danger)'}}>{state.error}</p>}
      {state.ok && (
        <>
          <p>✅ Invitación aceptada. Ya tienes acceso a la deuda.</p>
          <button className="btn" onClick={() => nav(`/debts/${state.debtId}`)}>Abrir deuda</button>
        </>
      )}
      <p className="small" style={{marginTop:10}}>
        Si te dio error, revisa que el token no haya expirado o que estés logueado.
      </p>
    </div>
  )
}
