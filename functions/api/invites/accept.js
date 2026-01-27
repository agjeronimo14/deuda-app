import { error } from '../_util/response.js'

export async function onRequestPost() {
  return error(410, 'Invites por token fueron eliminados. Pide al ADMIN usuario+contraseña.')
}
