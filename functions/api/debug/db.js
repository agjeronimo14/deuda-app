import { json, error } from '../_util/response.js'

export async function onRequestGet(context) {
  const { DB } = context.env
  if (!DB) return error(500, 'DB binding missing (variable name debe ser DB).')

  try {
    const tables = await DB.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1").all()
    const usersInfo = await DB.prepare("PRAGMA table_info(users);").all().catch(() => ({ results: [] }))
    return json({
      ok: true,
      tables: (tables.results || []).map(r => r.name),
      users_columns: (usersInfo.results || []).map(c => ({ name: c.name, type: c.type, notnull: c.notnull, pk: c.pk })),
    })
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e)
    return error(500, `DB error: ${msg}`)
  }
}
