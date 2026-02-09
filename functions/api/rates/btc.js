import { json } from '../_util/response.js'

// GET /api/rates/btc
// Always returns JSON (status 200) to avoid noisy "Failed to load resource 502" in console
// when the rate provider is down or rate-limited.
export async function onRequestGet() {
  const ts = new Date().toISOString()

  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur'
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
    })

    if (!res.ok) {
      return json({ ok: false, usd: null, eur: null, error: `BTC rate fetch failed: ${res.status}`, ts })
    }

    const data = await res.json()
    const usd = data?.bitcoin?.usd
    const eur = data?.bitcoin?.eur

    if (!usd) {
      return json({ ok: false, usd: null, eur: null, error: 'BTC rate missing', ts })
    }

    return json({ ok: true, usd, eur: eur ?? null, ts })
  } catch (e) {
    return json({ ok: false, usd: null, eur: null, error: String(e?.message || e), ts })
  }
}
