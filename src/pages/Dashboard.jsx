import React from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import DebtModal from '../ui/DebtModal.jsx'

function money(cents, currency='USD') {
  const value = (cents || 0) / 100
  return new Intl.NumberFormat('en-US', { style:'currency', currency }).format(value)
}

export default function Dashboard({ me }) {
  const [data, setData] = React.useState({ owned: [], shared: [] })
  const [tab, setTab] = React.useState('owned')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [open, setOpen] = React.useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      const d = await api('/api/debts')
      setData(d)
    } catch (e) {
      setError(e.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { load() }, [])

  const list = tab === 'owned' ? data.owned : data.shared
  const isCounterparty = (me?.role === 'counterparty')
  const canCreateDebt = !!me && !isCounterparty

  return (
    <>
      <div className="card">
        <div className="split">
          <div>
            <h2>Dashboard</h2>
            <p className="small">En “Yo debo”, la contraparte confirma o rechaza los abonos.</p>
          </div>
          <div className="row">
            {canCreateDebt && <button className="btn" onClick={() => setOpen(true)}>+ Nueva deuda</button>}
            <button className="btn secondary" onClick={load}>Actualizar</button>
          </div>
        </div>

        {isCounterparty && (
          <p className="small" style={{marginTop:10}}>
            Tu cuenta es de <b>contraparte</b>: puedes ver deudas compartidas contigo y <b>confirmar/rechazar abonos</b>.
          </p>
        )}

        <div className="hr"></div>

        <div className="tabs">
          <button className={'tab ' + (tab==='owned'?'active':'')} onClick={()=>setTab('owned')}>Mis deudas</button>
          <button className={'tab ' + (tab==='shared'?'active':'')} onClick={()=>setTab('shared')}>Compartidas conmigo</button>
        </div>

        {error && <p style={{color:'var(--danger)'}}>{error}</p>}
        {loading ? <p>Cargando...</p> : (
          <table className="table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Dirección</th>
                <th>Saldo</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan="5" className="small">No hay registros.</td></tr>
              ) : list.map(d => (
                <tr key={d.id}>
                  <td>
                    {d.title}
                    <div className="small">
                      {tab === 'shared'
                        ? `Deudor: ${d.owner_username || '—'}`
                        : (d.counterparty_name || '')}
                    </div>
                  </td>
                  <td><span className="badge">{d.direction === 'I_OWE' ? 'Yo debo' : 'Me deben'}</span></td>
                  <td><b>{money(d.balance_cents, d.currency)}</b></td>
                  <td className="small">{d.due_date || '—'}</td>
                  <td><Link className="btn secondary" to={`/debts/${d.id}`}>Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && <DebtModal onClose={() => setOpen(false)} onCreated={() => { load() }} me={me} />}
    </>
  )
}
