import React from 'react'
import { api } from '../api.js'

function toSatsFromBtcString(str) {
  const v = Number(String(str || '').trim())
  if (!Number.isFinite(v) || v <= 0) return null
  return Math.round(v * 100000000)
}

export default function DebtModal({ onClose, onCreated, me }) {
  const [title, setTitle] = React.useState('')
  const [counterparty_name, setCounterpartyName] = React.useState('')
  const [counterparty_username, setCounterpartyUsername] = React.useState('')
  const [direction, setDirection] = React.useState('I_OWE')

  // manual USD vs BTC (con montos manuales USD/EUR)
  const [amountMode, setAmountMode] = React.useState('manual_usd') // manual_usd | btc_anchored_usd

  const [usdPrincipal, setUsdPrincipal] = React.useState('')
  const [eurPrincipal, setEurPrincipal] = React.useState('')
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

  React.useEffect(() => {
    // Cuando es "Yo debo" no usamos modo BTC
    if (direction === 'I_OWE') {
      setAmountMode('manual_usd')
      setBtcSent('')
      setEurPrincipal('')
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

  function previewFromBtc() {
    const sats = toSatsFromBtcString(btcSent)
    if (!sats || !rates) return null
    const btc = sats / 100000000
    return {
      usd: btc * rates.usd,
      eur: btc * rates.eur
    }
  }

  function fillFromBtcRates() {
    const pv = previewFromBtc()
    if (!pv) return
    setUsdPrincipal(pv.usd.toFixed(2))
    setEurPrincipal(pv.eur.toFixed(2))
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
        amount_mode: amountMode,
      }

      if (!body.counterparty_username) throw new Error('Debes indicar el usuario de la contraparte.')

      if (direction === 'OWED_TO_ME' && amountMode === 'btc_anchored_usd') {
        const sats = toSatsFromBtcString(btcSent)
        if (!sats) throw new Error('BTC enviado inválido')
        body.btc_sent_sats = sats

        const usd = Number(usdPrincipal)
        if (!Number.isFinite(usd) || usd <= 0) throw new Error('Monto USD inválido (obligatorio)')
        body.principal_cents = Math.round(usd * 100)

        const eur = Number(eurPrincipal)
        if (Number.isFinite(eur) && eur > 0) body.principal_eur_cents = Math.round(eur * 100)

        // opcional: guardar tasas si existen
        if (rates?.usd && rates?.eur) {
          body.btc_rate_usd_at_send = rates.usd
          body.btc_rate_eur_at_send = rates.eur
        }
      } else {
        const usd = Number(usdPrincipal)
        if (!Number.isFinite(usd) || usd <= 0) throw new Error('Monto inválido')
        body.principal_cents = Math.round(usd * 100)
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

  const showAmountMode = (direction === 'OWED_TO_ME')

  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="split">
          <h2>Nueva deuda</h2>
          <button className="btn secondary" onClick={onClose}>Cerrar</button>
        </div>

        <form onSubmit={submit}>
          <label>Título</label>
          <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Renta, préstamo..." required />

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
              <input className="input" value={counterparty_name} onChange={e=>setCounterpartyName(e.target.value)} placeholder="Juan / Maria..." />
            </div>
          </div>

          {showAmountMode && (
            <div style={{marginTop:8}}>
              <label>Modo</label>
              <div className="row" style={{gap:8, flexWrap:'wrap'}}>
                <button type="button" className={"btn " + (amountMode==='manual_usd' ? 'ok' : 'secondary')} onClick={()=>setAmountMode('manual_usd')}>
                  Manual (USD)
                </button>
                <button type="button" className={"btn " + (amountMode==='btc_anchored_usd' ? 'ok' : 'secondary')} onClick={()=>setAmountMode('btc_anchored_usd')}>
                  BTC (manual USD/EUR)
                </button>
              </div>
              <p className="small" style={{marginTop:6}}>
                Recomendado: en BTC, tú escribes el USD (obligatorio) y EUR (opcional). Si quieres, puedes usar la tasa para autollenar, pero no es requerido.
              </p>
            </div>
          )}

          {direction === 'OWED_TO_ME' && amountMode === 'btc_anchored_usd' && (
            <div style={{marginTop:10}}>
              <label>BTC enviado</label>
              <input className="input" value={btcSent} onChange={e=>setBtcSent(e.target.value)} placeholder="0.00885" required />

              <div className="grid" style={{marginTop:10}}>
                <div>
                  <label>Monto (USD) *</label>
                  <input className="input" value={usdPrincipal} onChange={e=>setUsdPrincipal(e.target.value)} placeholder="450.00" required />
                </div>
                <div>
                  <label>Equivalente (EUR) opcional</label>
                  <input className="input" value={eurPrincipal} onChange={e=>setEurPrincipal(e.target.value)} placeholder="410.00" />
                </div>
              </div>

              <div className="row" style={{marginTop:10, gap:8, flexWrap:'wrap'}}>
                <button type="button" className="btn secondary" onClick={loadRates}>Cargar tasa BTC</button>
                <button type="button" className="btn secondary" onClick={fillFromBtcRates} disabled={!rates}>Autollenar USD/EUR</button>
                {rateErr && <span className="small" style={{color:'var(--danger)'}}>{rateErr}</span>}
              </div>

              {previewFromBtc() && (
                <p className="small" style={{marginTop:8}}>
                  Preview (tasa actual): <b>${previewFromBtc().usd.toFixed(2)}</b> USD · <b>€{previewFromBtc().eur.toFixed(2)}</b> EUR
                </p>
              )}
            </div>
          )}

          {!(direction === 'OWED_TO_ME' && amountMode === 'btc_anchored_usd') && (
            <div style={{marginTop:10}}>
              <label>Monto (USD)</label>
              <input className="input" value={usdPrincipal} onChange={e=>setUsdPrincipal(e.target.value)} placeholder="250.00" required />
            </div>
          )}

          <label style={{marginTop:10}}>Usuario de la contraparte (requerido)</label>
          <input
            className="input"
            value={counterparty_username}
            onChange={e=>setCounterpartyUsername(e.target.value)}
            placeholder="ariana"
            list="counterpartyUsers"
            required
          />
          <datalist id="counterpartyUsers">
            {counterpartyList.map(u => <option key={u.id} value={u.username} />)}
          </datalist>

          <label style={{marginTop:10}}>Notas (opcional)</label>
          <textarea className="input" rows="3" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Detalles..." />

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
