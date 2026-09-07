import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api.js'

function money(cents, currency='USD') {
  return new Intl.NumberFormat('en-US', { style:'currency', currency }).format((Number(cents) || 0) / 100)
}

function btc(sats) {
  if (sats == null) return null
  return (Number(sats) / 100000000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
}

function date(value) {
  return value ? String(value).slice(0, 10) : '—'
}

export default function PublicDebt() {
  const { token } = useParams()
  const [report, setReport] = React.useState(null)
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true); setError('')
      try {
        const data = await api(`/api/public/debts/${token}`)
        if (active) setReport(data.report)
      } catch (e) {
        if (active) setError(e.message || 'No se pudo abrir el reporte')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [token])

  if (loading) return <div className="card"><p>Cargando reporte...</p></div>
  if (error || !report) {
    return <div className="card">
      <h2>Reporte no disponible</h2>
      <p style={{color:'var(--danger)'}}>{error || 'El enlace no es válido.'}</p>
      <p className="small">Puede haber vencido o haber sido desactivado por quien lleva el control.</p>
    </div>
  }

  return (
    <div className="card">
      <div className="split">
        <div>
          <h2>Estado de la deuda</h2>
          <p className="small">Reporte de solo lectura · último movimiento {date(report.last_movement_at || report.updated_at)}</p>
        </div>
        <Link className="btn secondary" to="/login">Iniciar sesión</Link>
      </div>

      <div className="hr"></div>
      <h3>{report.title}</h3>
      <div className="stats">
        <div className="stat">
          <div className="statLabel">Monto inicial</div>
          <div className="statValue money xl">{money(report.principal_cents, report.currency)}</div>
        </div>
        <div className="stat">
          <div className="statLabel">Saldo actual</div>
          <div className="statValue money xl">{money(report.balance_cents, report.currency)}</div>
        </div>
        <div className="stat">
          <div className="statLabel">Total abonado</div>
          <div className="statValue money big">{money(report.payments_cents, report.currency)}</div>
        </div>
        {report.charges_cents > 0 && (
          <div className="stat">
            <div className="statLabel">Aumentos</div>
            <div className="statValue money big">{money(report.charges_cents, report.currency)}</div>
          </div>
        )}
        {report.principal_eur_cents != null && (
          <div className="stat">
            <div className="statLabel">Equivalente inicial (EUR)</div>
            <div className="statValue money big">{money(report.principal_eur_cents, 'EUR')}</div>
          </div>
        )}
        {report.balance_eur_cents != null && (
          <div className="stat">
            <div className="statLabel">Saldo actual (EUR)</div>
            <div className="statValue money big">{money(report.balance_eur_cents, 'EUR')}</div>
          </div>
        )}
        {report.btc_sent_sats != null && (
          <div className="stat">
            <div className="statLabel">BTC inicial</div>
            <div className="statValue money big">{btc(report.btc_sent_sats)} BTC</div>
          </div>
        )}
        {report.balance_btc_sats != null && (
          <div className="stat">
            <div className="statLabel">Saldo actual (BTC)</div>
            <div className="statValue money big">{btc(report.balance_btc_sats)} BTC</div>
          </div>
        )}
      </div>
      {report.due_date && <p className="small" style={{marginTop:12}}>Fecha indicada: {date(report.due_date)}</p>}
      {report.expires_at && <p className="small">Este enlace vence el {date(report.expires_at)}.</p>}

      <div className="hr"></div>
      <h3>Movimientos confirmados</h3>
      <table className="table">
        <thead>
          <tr><th>Fecha</th><th>Tipo</th><th>Monto</th></tr>
        </thead>
        <tbody>
          {!report.movements.length ? (
            <tr><td colSpan="3" className="small">Aún no hay movimientos confirmados.</td></tr>
          ) : report.movements.map((movement, index) => (
            <tr key={`${movement.paid_at}-${index}`}>
              <td className="small">{date(movement.paid_at)}</td>
              <td>{movement.kind === 'CHARGE' ? 'Aumento' : 'Abono'}</td>
              <td className="money big">{money(movement.amount_cents, report.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
