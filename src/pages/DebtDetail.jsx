import React from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

function money(cents, currency='USD') {
  const value = (cents || 0) / 100
  return new Intl.NumberFormat('en-US', { style:'currency', currency }).format(value)
}

function fmtDate(iso) {
  return iso ? String(iso).slice(0,10) : '—'
}

function dirLabel(direction, viewerIsCounterparty){
  if(!viewerIsCounterparty){
    return direction === 'I_OWE' ? 'Yo debo' : 'Me deben'
  }
  return direction === 'I_OWE' ? 'Me deben' : 'Yo debo'
}

function whoOwesLabel(direction, ownerUsername){
  // solo para contraparte: mostrar quién debe
  return direction === 'I_OWE' ? `Deudor: ${ownerUsername || '—'}` : `Acreedor: ${ownerUsername || '—'}`
}


export default function DebtDetail({ me }) {
  const { id } = useParams()
  const nav = useNavigate()
  const [data, setData] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const [amount, setAmount] = React.useState('')
  const [paid_at, setPaidAt] = React.useState(() => new Date().toISOString().slice(0,10))
  const [note, setNote] = React.useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const d = await api(`/api/debts/${id}`)
      setData(d)
    } catch (e) {
      setError(e.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { load() }, [id])

  async function addPayment(e) {
    e.preventDefault()
    setError('')
    try {
      const dollars = Number(amount)
      if (!Number.isFinite(dollars) || dollars <= 0) throw new Error('Monto inválido')
      const amount_cents = Math.round(dollars * 100)
      await api(`/api/debts/${id}/payments`, { method:'POST', body:{ amount_cents, paid_at, note: note || null } })
      setAmount(''); setNote('')
      await load()
    } catch(e) {
      setError(e.message || 'Error')
    }
  }

  async function confirmPayment(pid, ok) {
    setError('')
    try {
      await api(`/api/payments/${pid}/${ok ? 'confirm' : 'reject'}`, { method:'POST', body:{} })
      await load()
    } catch(e) {
      setError(e.message || 'Error')
    }
  }

  async function deletePayment(pid) {
    if(!confirm('¿Eliminar este abono?')) return
    setError('')
    try{
      await api(`/api/payments/${pid}`, { method:'DELETE' })
      await load()
    }catch(e){ setError(e.message || 'Error') }
  }

  async function deleteDebt() {
    if(!confirm('¿Eliminar esta deuda (y todos sus abonos)?')) return
    setError('')
    try{
      await api(`/api/debts/${id}`, { method:'DELETE' })
      nav('/')
    }catch(e){ setError(e.message || 'Error') }
  }

  async function editDebt() {
    const d = data?.debt
    if (!d) return
    const title = prompt('Título', d.title || '') ?? null
    if (title === null) return
    const counterparty_name = prompt('Contraparte (nombre)', d.counterparty_name || '') ?? null
    if (counterparty_name === null) return
    const due_date = prompt('Fecha (YYYY-MM-DD)', d.due_date || '') ?? null
    if (due_date === null) return
    const notes = prompt('Notas (opcional)', d.notes || '') ?? null
    if (notes === null) return

    // opcional: cambiar contraparte por username
    const currentCp = data?.share?.counterparty_username || ''
    const counterparty_username = prompt('Usuario de la contraparte (vacío para quitar vínculo)', currentCp) 
    if (counterparty_username === null) return

    setError('')
    try{
      await api(`/api/debts/${id}`, { method:'PUT', body:{
        title: title.trim(),
        counterparty_name: counterparty_name.trim() || null,
        due_date: due_date.trim() || null,
        notes: notes.trim() || null,
        counterparty_username: counterparty_username.trim() || null,
      }})
      await load()
    }catch(e){ setError(e.message || 'Error') }
  }

  if (loading) return <div className="card"><p>Cargando...</p></div>
  if (error) return <div className="card"><p style={{color:'var(--danger)'}}>{error}</p><Link className="btn secondary" to="/">Volver</Link></div>
  if (!data) return null

  const d = data.debt
  const share = data.share
  const access = data.access
  const isOwner = access === 'OWNER'
  const isAdminAccess = access === 'ADMIN'
  const isCounterparty = access === 'COUNTERPARTY'
  const canEdit = isOwner || isAdminAccess
  const canAddPayments = isOwner || isAdminAccess
  const canConfirm = isCounterparty && d.direction === 'I_OWE' && share?.can_confirm

  return (
    <div className="card">
      <div className="split">
        <div>
          <h2>{d.title}</h2>
          <p className="small">
            {d.counterparty_name || ''}{' '}
            {(isCounterparty ? <span className="pill">{dirLabel(d.direction, true)}</span> : (d.direction === 'I_OWE' ? <span className="pill">Yo debo</span> : <span className="pill">Me deben</span>))}
            {' '}
            {isCounterparty && <span className="pill">{whoOwesLabel(d.direction, data.owner_username)}</span>}
            {isAdminAccess && <span className="pill">ADMIN</span>}
          </p>
        </div>
        <div className="row">
          <Link className="btn secondary" to="/">Volver</Link>
          {canEdit && <button className="btn secondary" onClick={editDebt}>Editar</button>}
          {canEdit && <button className="btn danger" onClick={deleteDebt}>Eliminar</button>}
        </div>
      </div>

      <div className="hr"></div>

      <div className="grid" style={{gap:12}}>
        <div className="card" style={{padding:12}}>
          <h3>Resumen</h3>
          <div className="stats">
            <div className="stat">
              <div className="statLabel">Principal</div>
              <div className="statValue money xl">{money(d.principal_cents, d.currency)}</div>
            </div>
            <div className="stat">
              <div className="statLabel">Saldo</div>
              <div className="statValue money xl">{money(data.balance_cents, d.currency)}</div>
            </div>
          </div>
          <p className="small">Fecha: {d.due_date || '—'}</p>
          <p className="small">Compartida: {share ? '✅' : '—'} · Puede confirmar: {share?.can_confirm ? 'sí' : 'no'}</p>
          {share?.counterparty_username && <p className="small">Usuario contraparte: <b>{share.counterparty_username}</b></p>}
        </div>

        {canAddPayments && (
          <div className="card" style={{padding:12}}>
            <h3>Registrar abono</h3>
            <form onSubmit={addPayment}>
              <label>Monto (USD)</label>
              <input className="input" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="25.00" required />
              <div className="grid">
                <div>
                  <label>Fecha</label>
                  <input className="input" type="date" value={paid_at} onChange={e=>setPaidAt(e.target.value)} />
                </div>
                <div>
                  <label>Nota (opcional)</label>
                  <input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder="Transferencia, efectivo..." />
                </div>
              </div>
              <button className="btn ok" type="submit" style={{marginTop:10}}>Guardar abono</button>
              <p className="small" style={{marginTop:10}}>
                Si esta deuda es <b>Yo debo</b> y hay contraparte asignada, el abono queda en <b>PENDING</b> hasta que confirme.
              </p>
            </form>
          </div>
        )}

        {!canAddPayments && (
          <div className="card" style={{padding:12}}>
            <h3>Permisos</h3>
            <p className="small">Eres contraparte: puedes <b>confirmar/rechazar</b> abonos pendientes, pero no puedes registrar abonos ni editar la deuda.</p>
          </div>
        )}
      </div>

      <div className="hr"></div>

      <h3>Abonos</h3>
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
          {(data.payments || []).length === 0 ? (
            <tr><td colSpan="5" className="small">No hay abonos.</td></tr>
          ) : (data.payments || []).map(p => (
            <tr key={p.id}>
              <td className="small">{fmtDate(p.paid_at)}</td>
              <td><span className="money big">{money(p.amount_cents, d.currency)}</span></td>
              <td>
                <span className={'pill ' + (p.confirmation_status === 'CONFIRMED' ? 'ok' : (p.confirmation_status === 'REJECTED' ? 'danger' : ''))}>
                  {p.confirmation_status}
                </span>
              </td>
              <td className="small">{p.note || ''}</td>
              <td>
                <div className="row">
                  <button className="btn secondary" onClick={() => receiptPng({ debt:d, payment:p, owner_username: data.owner_username || (me?.username||''), counterparty_name: d.counterparty_name })}>
                    Imprimir PNG
                  </button>
                  {canConfirm && p.confirmation_status === 'PENDING' && (
                    <>
                      <button className="btn ok" onClick={()=>confirmPayment(p.id, true)}>Confirmar</button>
                      <button className="btn danger" onClick={()=>confirmPayment(p.id, false)}>Rechazar</button>
                    </>
                  )}
                  {(canEdit) && (
                    <button className="btn danger" onClick={()=>deletePayment(p.id)}>Eliminar</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p style={{color:'var(--danger)'}}>{error}</p>}
    </div>
  )
}

// genera un recibo simple en PNG (client-side)
async function receiptPng({ debt, payment, owner_username, counterparty_name }) {
  const canvas = document.createElement('canvas')
  const w = 900, h = 520
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')

  // background
  ctx.fillStyle = '#0b1220'
  ctx.fillRect(0,0,w,h)

  // card
  const pad = 40
  ctx.fillStyle = '#0f1a30'
  roundRect(ctx, pad, pad, w-2*pad, h-2*pad, 18, true, false)

  ctx.fillStyle = '#e8eefc'
  ctx.font = 'bold 34px system-ui, -apple-system, Segoe UI, Roboto'
  ctx.fillText('Recibo de abono', pad+30, pad+70)

  ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto'
  ctx.fillStyle = '#9fb3d6'
  ctx.fillText('Deuda:', pad+30, pad+120)
  ctx.fillText('Deudor:', pad+30, pad+155)
  ctx.fillText('Contraparte:', pad+30, pad+190)
  ctx.fillText('Fecha:', pad+30, pad+225)
  ctx.fillText('Monto:', pad+30, pad+260)
  ctx.fillText('Estado:', pad+30, pad+295)
  ctx.fillText('Nota:', pad+30, pad+330)

  ctx.fillStyle = '#e8eefc'
  ctx.font = 'bold 18px system-ui, -apple-system, Segoe UI, Roboto'
  ctx.fillText(debt.title || '', pad+160, pad+120)
  ctx.fillText(owner_username || '', pad+160, pad+155)
  ctx.fillText(counterparty_name || '', pad+160, pad+190)
  ctx.fillText(String(payment.paid_at || '').slice(0,10), pad+160, pad+225)

  const value = (payment.amount_cents || 0) / 100
  ctx.fillText(new Intl.NumberFormat('en-US', { style:'currency', currency: debt.currency || 'USD' }).format(value), pad+160, pad+260)

  ctx.fillText(payment.confirmation_status || '—', pad+160, pad+295)

  ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto'
  wrapText(ctx, payment.note || '', pad+160, pad+330, w-2*pad-190, 20)

  // footer
  ctx.fillStyle = '#9fb3d6'
  ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto'
  ctx.fillText(`Generado: ${new Date().toISOString().slice(0,19).replace('T',' ')}`, pad+30, h-pad-18)

  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `recibo_${debt.id}_${payment.id}.png`
  a.click()
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (typeof radius === 'number') radius = {tl:radius,tr:radius,br:radius,bl:radius}
  ctx.beginPath()
  ctx.moveTo(x + radius.tl, y)
  ctx.lineTo(x + width - radius.tr, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr)
  ctx.lineTo(x + width, y + height - radius.br)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height)
  ctx.lineTo(x + radius.bl, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl)
  ctx.lineTo(x, y + radius.tl)
  ctx.quadraticCurveTo(x, y, x + radius.tl, y)
  ctx.closePath()
  if (fill) ctx.fill()
  if (stroke) ctx.stroke()
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(' ')
  let line = ''
  let yy = y
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' '
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, yy)
      line = words[n] + ' '
      yy += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line, x, yy)
}
