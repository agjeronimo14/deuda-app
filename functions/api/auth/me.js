import { json } from '../_util/response.js'
import { requireUser } from '../_util/auth.js'

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context)
  if (response) return response
  return json({ user })
}
