import React from 'react'
import { api } from '../api.js'

export default function DebtModal({ onClose, onCreated }) {
  const [title, setTitle] = React.useState('')
  const [counterparty_name, setCounterpartyName] = React.useState('')
  const [direction, setDirection] = React.useState('I_OWE')
  const [principal, setPrincipal] = React.useState('')
  const [due_date, setDueDate] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const dollars = Number(principal)
      if (!Number.isFinite(dollars) || dollars <= 0) throw new Error('Monto inválido')
      const principal_cents = Math.round(dollars * 100)
      await api('/api/debts', { method:'POST', body: { title, counterparty_name, direction, principal_cents, due_date: due_date || null, notes: notes || null, currency: 'USD' } })
      onCreated?.()
    } catch(e) {
      setError(e.message || 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="split">
          <h2>Nueva deuda</h2>
          <button className="btn secondary" onClick={onClose}>Cerrar</button>
        </div>
        <form onSubmit={submit}>
          <label>Título</label>
          <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Teléfono, préstamo, renta..." required />

          <div className="grid">
            <div>
              <label>Dirección</label>
              <select className="input" value={direction} onChange={e=>setDirection(e.target.value)}>
                <option value="I_OWE">Yo debo</option>
                <option value="OWED_TO_ME">Me deben</option>
              </select>
            </div>
            <div>
              <label>Contraparte (nombre)</label>
              <input className="input" value={counterparty_name} onChange={e=>setCounterpartyName(e.target.value)} placeholder="Juan / Maria / Empresa..." />
            </div>
          </div>

          <div className="grid">
            <div>
              <label>Monto (USD)</label>
              <input className="input" value={principal} onChange={e=>setPrincipal(e.target.value)} placeholder="250.00" required />
            </div>
            <div>
              <label>Fecha de vencimiento</label>
              <input className="input" type="date" value={due_date} onChange={e=>setDueDate(e.target.value)} />
            </div>
          </div>

          <label>Notas (opcional)</label>
          <textarea className="input" rows="3" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Detalles, condiciones..." />

          {error && <p style={{color:'var(--danger)'}}>{error}</p>}

          <div className="row" style={{marginTop:12}}>
            <button className="btn ok" disabled={busy}>{busy ? '...' : 'Crear'}</button>
            <button className="btn secondary" type="button" onClick={onClose}>Cancelar</button>
          </div>

          <p className="small" style={{marginTop:10}}>
            Luego de crear, puedes generar un <b>invite</b> para que la contraparte confirme abonos (si es “Yo debo”).
          </p>
        </form>
      </div>
    </div>
  )
}
