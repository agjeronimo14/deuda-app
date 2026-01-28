export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  // Si el backend responde 401, disparo un evento global para forzar re-login
  if (res.status === 401) {
    try { window.dispatchEvent(new CustomEvent('auth:unauthorized')) } catch {}
  }

  const text = await res.text()

  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // El server devolvió HTML (ej: error 500). Evitamos el "Unexpected token <"
    throw new Error('Respuesta no-JSON del server (posible error 500). Revisa Cloudflare Pages → Functions logs.')
  }

  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}
