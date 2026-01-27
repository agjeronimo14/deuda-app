import { toBase64Url, fromBase64Url } from './base64url.js'

const enc = new TextEncoder()

export function randomToken(bytes = 32) {
  const u8 = crypto.getRandomValues(new Uint8Array(bytes))
  return toBase64Url(u8)
}

export async function sha256Base64Url(input) {
  const data = typeof input === 'string' ? enc.encode(input) : input
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toBase64Url(new Uint8Array(digest))
}

function constTimeEqual(a, b) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i=0;i<a.length;i++) r |= (a.charCodeAt(i) ^ b.charCodeAt(i))
  return r === 0
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iterations = 100_000
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt, iterations }, key, 256)
  const hash = new Uint8Array(bits)
  return `pbkdf2$${iterations}$${toBase64Url(salt)}$${toBase64Url(hash)}`
}

export async function verifyPassword(password, stored) {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  const salt = fromBase64Url(parts[2])
  const expected = parts[3]

  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt, iterations }, key, 256)
  const actual = toBase64Url(new Uint8Array(bits))
  return constTimeEqual(actual, expected)
}
