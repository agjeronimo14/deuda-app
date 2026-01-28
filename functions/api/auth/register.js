import { error } from '../_util/response.js'

export async function onRequestPost() {
  // Registro público deshabilitado: SOLO el ADMIN crea usuarios desde /admin
  return error(403, 'Registro deshabilitado. Pide al ADMIN que cree tu usuario.')
}
