import { json, error } from '../_util/response.js'

// GET /api/rates/btc  -> { ok:true, usd:<number>, eur:<number>, source:'coingecko', ts:<iso> }
export async function onRequestGet() {
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur'
    const res = await fetch(url, { headers: { 'accept': 'application/json' } })
    if (!res.ok) return error(502, 'No se pudo obtener la tasa BTC (API).')
    const data = await res.json()
    const usd = Number(data?.bitcoin?.usd)
    const eur = Number(data?.bitcoin?.eur)
    if (!Number.isFinite(usd) || !Number.isFinite(eur)) return error(502, 'Tasa BTC inválida.')
    return json({ ok: true, usd, eur, source: 'coingecko', ts: new Date().toISOString() })
  } catch {
    return error(502, 'Error obteniendo la tasa BTC.')
  }
}
