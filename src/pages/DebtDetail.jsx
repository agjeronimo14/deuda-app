import React from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.js'

function money(cents, currency='USD') {
  const value = (cents || 0) / 100
  return new Intl.NumberFormat('en-US', { style:'currency', currency }).format(value)
}

function badge(status){
  if(status==='CONFIRMED') return <span className="badge ok">CONFIRMED</span>
  if(status==='PENDING') return <span className="badge warn">PENDING</span>
  if(status==='REJECTED') return <span className="badge danger">REJECTED</span>
  return <span className="badge">NONE</span>
}

export default function DebtDetail() {
  const { id } = useParams()
  const [d, setD] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [inviteToken, setInviteToken] = React.useState('')
  const [payAmount, setPayAmount] = React.useState('')
  const [payDate, setPayDate] = React.useState(() => new Date().toISOString().slice(0,10))
  const [payNote, setPayNote] = React.useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const data = await api(`/api/debts/${id}`)
      setD(data)
    } catch(e) {
      setError(e.message || 'Error')
    } finally {
      setLoading(false)
    }
  }
  React.useEffect(() => { load() }, [id])

  async function createInvite() {
    setError(''); setInviteToken('')
    try {
      const data = await api(`/api/debts/${id}/invite`, { method:'POST', body: {} })
      setInviteToken(data.token)
    } catch(e) { setError(e.message || 'Error') }
  }

  async function addPayment() {
    setError('')
    try {
      const dollars = Number(payAmount)
      if (!Number.isFinite(dollars) || dollars <= 0) throw new Error('Monto inválido')
      const amount_cents = Math.round(dollars * 100)
      await api(`/api/debts/${id}/payments`, { method:'POST', body: { amount_cents, paid_at: payDate, note: payNote }})
      setPayAmount(''); setPayNote('')
      await load()
    } catch(e) { setError(e.message || 'Error') }
  }

  async function confirm(paymentId) {
    setError('')
    try {
      await api(`/api/payments/${paymentId}/confirm`, { method:'POST', body: { note: '' }})
      await load()
    } catch(e) { setError(e.message || 'Error') }
  }

  async function reject(paymentId) {
    const note = prompt('Motivo (opcional):') || ''
    setError('')
    try {
      await api(`/api/payments/${paymentId}/reject`, { method:'POST', body: { note }})
      await load()
    } catch(e) { setError(e.message || 'Error') }
  }

  if (loading) return <div className="card"><p>Cargando...</p></div>
  if (error) return <div className="card"><p style={{color:'var(--danger)'}}>{error}</p><button className="btn secondary" onClick={load}>Reintentar</button></div>
  if (!d) return null

  const isOwner = d.access === 'OWNER'
  const isCounterparty = d.access === 'COUNTERPARTY'

  return (
    <div className="card">
      <div className="split">
        <div>
          <h2>{d.debt.title}</h2>
          <p className="small">{d.debt.counterparty_name || ''}</p>
        </div>
        <div className="row">
          <span className="badge">{d.debt.direction === 'I_OWE' ? 'Yo debo' : 'Me deben'}</span>
          <span className="badge">{d.debt.status}</span>
        </div>
      </div>

      <div className="hr"></div>

      <div className="grid">
        <div className="card" style={{padding:12}}>
          <h2>Resumen</h2>
          <p><b>Principal:</b> {money(d.debt.principal_cents, d.debt.currency)}</p>
          <p><b>Saldo:</b> {money(d.balance_cents, d.debt.currency)}</p>
          <p><b>Vence:</b> <span className="small">{d.debt.due_date || '—'}</span></p>
          {d.share && (
            <p className="small">
              Compartida: {d.share.accepted_at ? '✅ aceptada' : '⏳ pendiente'} · Puede confirmar: {d.share.can_confirm ? 'sí' : 'no'}
            </p>
          )}
        </div>

        {isOwner && (
          <div className="card" style={{padding:12}}>
            <h2>Invitar a la contraparte</h2>
            <p className="small">Genera un token y envíaselo. La contraparte entra en <b>tu misma web</b> y acepta el invite.</p>
            <button className="btn" onClick={createInvite}>Generar invite</button>
            {inviteToken && (
              <div style={{marginTop:10}}>
                <label>Token (solo se muestra aquí)</label>
                <input className="input" value={inviteToken} readOnly />
                <p className="small">Link directo: <code>/invite/{inviteToken}</code></p>
              </div>
            )}
          </div>
        )}

        {isOwner && (
          <div className="card" style={{padding:12}}>
            <h2>Registrar abono</h2>
            <label>Monto (USD)</label>
            <input className="input" value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="25.00" />
            <div className="grid">
              <div>
                <label>Fecha</label>
                <input className="input" type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} />
              </div>
              <div>
                <label>Nota (opcional)</label>
                <input className="input" value={payNote} onChange={e=>setPayNote(e.target.value)} placeholder="Transferencia, efectivo..." />
              </div>
            </div>
            <div className="row" style={{marginTop:10}}>
              <button className="btn ok" onClick={addPayment}>Guardar abono</button>
            </div>
            <p className="small">Si esta deuda es <b>Yo debo</b> y la contraparte aceptó el invite, el abono queda en <b>PENDING</b> hasta que confirme.</p>
          </div>
        )}
      </div>

      <div className="hr"></div>

      <h2>Abonos</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Monto</th>
            <th>Estado</th>
            <th>Nota</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {d.payments.length === 0 ? (
            <tr><td colSpan="5" className="small">No hay abonos.</td></tr>
          ) : d.payments.map(p => (
            <tr key={p.id}>
              <td className="small">{p.paid_at}</td>
              <td><b>{money(p.amount_cents, d.debt.currency)}</b></td>
              <td>{badge(p.confirmation_status)}</td>
              <td className="small">{p.note || ''}</td>
              <td>
                {isCounterparty && p.confirmation_status === 'PENDING' ? (
                  <div className="row">
                    <button className="btn ok" onClick={() => confirm(p.id)}>Confirmar</button>
                    <button className="btn danger" onClick={() => reject(p.id)}>Rechazar</button>
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!isOwner && (
        <p className="small" style={{marginTop:10}}>
          Vista de contraparte: aquí solo puedes confirmar/rechazar abonos PENDING.
        </p>
      )}
    </div>
  )
}
