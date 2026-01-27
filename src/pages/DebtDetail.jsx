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

async function receiptPNG({ debt, payment, me }) {
  const w = 900, h = 560
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')

  // background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)

  // header
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 32px Arial'
  ctx.fillText('RECIBO DE ABONO', 40, 60)

  ctx.fillStyle = '#374151'
  ctx.font = '16px Arial'
  ctx.fillText('Deuda App', 40, 88)

  // box
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 2
  ctx.strokeRect(40, 110, w-80, 360)

  const lines = [
    ['Deuda', debt.title],
    ['Contraparte', debt.counterparty_name || '—'],
    ['Usuario', me?.username || me?.email || '—'],
    ['Fecha abono', payment.paid_at],
    ['Monto', money(payment.amount_cents, debt.currency)],
    ['Estatus', payment.confirmation_status],
    ['Nota', payment.note || '—'],
  ]

  let y = 150
  for (const [k,v] of lines) {
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 18px Arial'
    ctx.fillText(`${k}:`, 60, y)

    ctx.fillStyle = '#111827'
    ctx.font = '18px Arial'
    // wrap for note
    const text = String(v ?? '')
    if (k === 'Nota' && text.length > 60) {
      const parts = [text.slice(0,60), text.slice(60,120), text.slice(120)]
      let yy = y
      for (const part of parts) {
        if (!part) continue
        ctx.fillText(part, 220, yy)
        yy += 26
      }
      y = yy - 26
    } else {
      ctx.fillText(text, 220, y)
    }
    y += 34
  }

  // footer
  ctx.fillStyle = '#6b7280'
  ctx.font = '14px Arial'
  ctx.fillText(`Generado: ${new Date().toISOString().slice(0,19).replace('T',' ')}`, 40, 520)

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  const url = URL.createObjectURL(blob)

  // En desktop: descarga. En iPhone: se abre en pestaña para compartir/guardar.
  const a = document.createElement('a')
  a.href = url
  a.download = `recibo-abono-${payment.id}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(()=>URL.revokeObjectURL(url), 3000)
}

export default function DebtDetail({ me }) {
  const { id } = useParams()
  const [d, setD] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
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
          <p><b>Fecha:</b> <span className="small">{d.debt.due_date || '—'}</span></p>

          {d.share && (
            <p className="small">
              Contraparte user: <b>{d.share.counterparty_username || '—'}</b> · Puede confirmar: {d.share.can_confirm ? 'sí' : 'no'}
            </p>
          )}

          <p className="small" style={{marginTop:8}}>
            Nota: ya no se usan tokens. La contraparte entra con <b>usuario + contraseña</b>.
          </p>
        </div>

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
            <p className="small">
              Si esta deuda es <b>Yo debo</b>, el abono queda <b>PENDING</b> hasta que la contraparte lo confirme (si tiene cuenta creada).
            </p>
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
                <div className="row">
                  <button className="btn secondary" onClick={()=>receiptPNG({ debt:d.debt, payment:p, me })}>Recibo PNG</button>
                  {isCounterparty && p.confirmation_status === 'PENDING' ? (
                    <>
                      <button className="btn ok" onClick={() => confirm(p.id)}>Confirmar</button>
                      <button className="btn danger" onClick={() => reject(p.id)}>Rechazar</button>
                    </>
                  ) : null}
                </div>
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
