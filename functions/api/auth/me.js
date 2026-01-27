import { json } from '../_util/response.js'
import { getSessionUser } from '../_util/auth.js'

export async function onRequestGet(context) {
  const user = await getSessionUser(context)
  return json({ user })
}
