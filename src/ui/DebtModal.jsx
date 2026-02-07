import React from 'react'
import { api } from '../api.js'

function toSatsFromBtcString(str) {
  const v = Number(String(str || '').trim())
  if (!Number.isFinite(v) || v <= 0) return null
  // BTC -> sats (rounded)
  return Math.round(v * 100000000)
}

export default function DebtModal({ onClose, onCreated, me }) {
  const [title, setTitle] = React.useState('')
  const [counterparty_name, setCounterpartyName] = React.useState('')
  const [counterparty_username, setCounterpartyUsername] = React.useState('')
  const [direction, setDirection] = React.useState('I_OWE')

  // manual USD (para deudas viejas) vs BTC anclado (para "Me deben" tipo renta/bitcoin)
  const [amountMode, setAmountMode] = React.useState('manual_usd') // manual_usd | btc_anchored_usd

  const [principal, setPrincipal] = React.useState('')
  const [btcSent, setBtcSent] = React.useState('')

  const [rates, setRates] = React.useState(null) // {usd, eur}
  const [rateErr, setRateErr] = React.useState('')

  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0,10))
  const [notes, setNotes] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [counterpartyList, setCounterpartyList] = React.useState([])

  const isCounterparty = (me?.role === 'counterparty')

  React.useEffect(() => {
    ;(async () => {
      try {
        const d = await api('/api/counterparties')
        setCounterpartyList(d.users || [])
      } catch {
        setCounterpartyList([])
      }
    })()
  }, [])

  // reset modes when switching direction
  React.useEffect(() => {
    if (direction === 'I_OWE') {
      setAmountMode('manual_usd')
      setBtcSent('')
      setRates(null)
      setRateErr('')
    }
  }, [direction])

  async function loadRates() {
    setRateErr('')
    try {
      const r = await api('/api/rates/btc')
      setRates({ usd: r.usd, eur: r.eur })
    } catch (e) {
      setRates(null)
      setRateErr(e.message || 'Error')
    }
  }

  function previewUsdEur() {
    const sats = toSatsFromBtcString(btcSent)
    if (!sats || !rates) return null
    const btc = sats / 100000000
    const usd = btc * rates.usd
    const eur = btc * rates.eur
    return { usd, eur, sats }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isCounterparty) throw new Error('Tu cuenta es de contraparte: no puedes crear deudas.')

      const body = {
        title,
        counterparty_name: counterparty_name || null,
        counterparty_username: (counterparty_username || '').trim() || null,
        direction,
        date,
        notes: notes || null,
        currency: 'USD',
        amount_mode: amountMode,
      }

      if (!body.counterparty_username) throw new Error('Debes indicar el usuario de la contraparte.')

      if (direction === 'OWED_TO_ME' && amountMode === 'btc_anchored_usd') {
        const sats = toSatsFromBtcString(btcSent)
        if (!sats) throw new Error('BTC enviado inválido')
        body.btc_sent_sats = sats

        // opcional: mandar la tasa para que el server use la misma que el preview
        if (rates?.usd && rates?.eur) {
          body.btc_rate_usd_at_send = rates.usd
          body.btc_rate_eur_at_send = rates.eur
        }

        // también mandamos un principal estimado (si el server decide ignorarlo, ok)
        const pv = previewUsdEur()
        if (pv?.usd) body.principal_cents = Math.round(pv.usd * 100)
      } else {
        const dollars = Number(principal)
        if (!Number.isFinite(dollars) || dollars <= 0) throw new Error('Monto inválido')
        body.principal_cents = Math.round(dollars * 100)
      }

      await api('/api/debts', { method:'POST', body })
      onCreated?.()
      onClose?.()
    } catch(e) {
      setError(e.message || 'Error')
    } finally {
      setBusy(false)
    }
  }

  const needCounterparty = true
  const showAmountMode = (direction === 'OWED_TO_ME')

  const pv = previewUsdEur()

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

          {showAmountMode && (
            <div style={{marginTop:8}}>
              <label>Cómo registrar el monto</label>
              <div className="row" style={{gap:8, flexWrap:'wrap'}}>
                <button type="button" className={"btn " + (amountMode==='manual_usd' ? 'ok' : 'secondary')} onClick={()=>setAmountMode('manual_usd')}>
                  Manual (USD)
                </button>
                <button type="button" className={"btn " + (amountMode==='btc_anchored_usd' ? 'ok' : 'secondary')} onClick={()=>setAmountMode('btc_anchored_usd')}>
                  Automático (BTC → USD/EUR)
                </button>
              </div>
              <p className="small" style={{marginTop:6}}>
                Manual = para deudas viejas. Automático = guardamos BTC enviado + la tasa del día (USD/EUR) y el principal queda anclado en USD.
              </p>
            </div>
          )}

          <div className="grid">
            <div>
              {direction === 'OWED_TO_ME' && amountMode === 'btc_anchored_usd' ? (
                <>
                  <label>BTC enviado</label>
                  <input className="input" value={btcSent} onChange={e=>setBtcSent(e.target.value)} placeholder="0.00885" required />
                  <div className="row" style={{marginTop:8, gap:8, flexWrap:'wrap'}}>
                    <button type="button" className="btn secondary" onClick={loadRates}>Actualizar tasa</button>
                    {rateErr && <span className="small" style={{color:'var(--danger)'}}>{rateErr}</span>}
                  </div>
                  {pv && (
                    <p className="small" style={{marginTop:8}}>
                      Preview: <b>${pv.usd.toFixed(2)}</b> USD · <b>€{pv.eur.toFixed(2)}</b> EUR · sats: <b>{pv.sats}</b>
                    </p>
                  )}
                </>
              ) : (
                <>
                  <label>Monto (USD)</label>
                  <input className="input" value={principal} onChange={e=>setPrincipal(e.target.value)} placeholder="250.00" required />
                </>
              )}
            </div>
            <div>
              <label>Fecha</label>
              <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
            </div>
          </div>

          <label>Usuario de la contraparte {needCounterparty ? '(requerido)' : '(opcional)'}</label>
          <input
            className="input"
            value={counterparty_username}
            onChange={e=>setCounterpartyUsername(e.target.value)}
            placeholder="ariana"
            list="counterpartyUsers"
            required={needCounterparty}
          />
          <datalist id="counterpartyUsers">
            {counterpartyList.map(u => <option key={u.id} value={u.username} />)}
          </datalist>

          <p className="small" style={{marginTop:6}}>
            Regla: si la contraparte <b>no existe</b>, no se crea la deuda. Pídele al <b>ADMIN</b> que cree ese usuario primero.
          </p>

          <label>Notas (opcional)</label>
          <textarea className="input" rows="3" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Detalles, condiciones..." />

          {error && <p style={{color:'var(--danger)'}}>{error}</p>}

          <div className="row" style={{marginTop:12}}>
            <button className="btn ok" disabled={busy}>{busy ? '...' : 'Crear'}</button>
            <button className="btn secondary" type="button" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
