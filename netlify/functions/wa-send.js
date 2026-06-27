exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  const WA_TOKEN = process.env.WA_TOKEN
  const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID
  const WA_API_VERSION = process.env.WA_API_VERSION || 'v21.0'

  const { to, message } = JSON.parse(event.body || '{}')
  if (!to || !message) return { statusCode: 400, body: JSON.stringify({ error: 'to and message required' }) }

  try {
    const r = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
    })
    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      throw new Error(`WhatsApp API ${r.status}: ${body?.error?.message ?? r.statusText}`)
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
