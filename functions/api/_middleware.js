export async function onRequest(context) {
  const { request, next } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  return await next()
}
