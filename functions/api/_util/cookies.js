export function parseCookies(req) {
  const header = req.headers.get('Cookie') || ''
  const out = {}
  header.split(';').map(v => v.trim()).filter(Boolean).forEach(pair => {
    const idx = pair.indexOf('=')
    if (idx === -1) return
    const k = pair.slice(0, idx).trim()
    const v = pair.slice(idx+1).trim()
    out[k] = decodeURIComponent(v)
  })
  return out
}

export function cookieString(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.path) parts.push(`Path=${opts.path}`)
  if (opts.httpOnly) parts.push('HttpOnly')
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`)
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}
