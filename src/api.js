let lastUnauthAt = 0
const UNAUTH_DEBOUNCE_MS = 1500

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  // Importante:
  // - NO disparamos "auth:unauthorized" en endpoints de auth (/api/auth/*) para evitar loops
  //   (ej: /api/auth/me devuelve 401 cuando no hay sesión)
  // - Debounce para evitar tormenta de eventos.
  const isAuthEndpoint = String(path || '').startsWith('/api/auth/')
  if (res.status === 401 && !isAuthEndpoint) {
    const now = Date.now()
    if (now - lastUnauthAt > UNAUTH_DEBOUNCE_MS) {
      lastUnauthAt = now
      try { window.dispatchEvent(new CustomEvent('auth:unauthorized')) } catch {}
    }
  }

  const text = await res.text()

  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error('Respuesta no-JSON del server (posible error 500). Revisa Cloudflare Pages → Functions logs.')
  }

  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}
