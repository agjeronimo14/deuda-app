export function toBase64Url(u8) {
  let str = ''
  for (const b of u8) str += String.fromCharCode(b)
  const b64 = btoa(str)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function fromBase64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i)
  return u8
}
