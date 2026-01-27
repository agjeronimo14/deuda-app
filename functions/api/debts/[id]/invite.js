import { error } from '../../_util/response.js'

export async function onRequestPost() {
  return error(410, 'Invites por token fueron eliminados. Ahora la deuda crea usuario+contraseña para la contraparte.')
}
