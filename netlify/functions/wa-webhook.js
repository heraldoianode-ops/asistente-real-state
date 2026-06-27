const { createClient } = require('@supabase/supabase-js')

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN
const WA_TOKEN = process.env.WA_TOKEN
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCHEMA = process.env.SUPABASE_SCHEMA || 'asistente_real_state'
const WA_API_VERSION = process.env.WA_API_VERSION || 'v21.0'
const SUMMARIZE_THRESHOLD = parseInt(process.env.SUMMARIZE_THRESHOLD || '10', 10)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: SCHEMA } })

function sanitizeLike(str) {
  return str.replace(/[%_\\]/g, (c) => `\\${c}`)
}

async function sendWAMessage(to, message) {
  const r = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
  })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error(`WhatsApp API ${r.status}: ${body?.error?.message ?? r.statusText}`)
  }
  return true
}

async function triggerSummarization(clientId) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/summarize-conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ client_id: clientId }),
    })
    return await res.json()
  } catch (err) {
    console.error(`[wa-webhook] Summarization error for client ${clientId}:`, err.message)
    return { ok: false, error: err.message }
  }
}

exports.handler = async (event) => {
  // GET — Meta webhook verification
  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {}
    if (params['hub.mode'] === 'subscribe' && params['hub.verify_token'] === VERIFY_TOKEN) {
      return { statusCode: 200, body: params['hub.challenge'] }
    }
    return { statusCode: 403, body: 'Forbidden' }
  }

  // POST — incoming messages
  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}')
    const entry = body?.entry?.[0]?.changes?.[0]?.value
    if (!entry?.messages?.length) return { statusCode: 200, body: 'OK' }

    const msg = entry.messages[0]
    if (!msg?.timestamp) return { statusCode: 200, body: 'OK' }

    const from = msg.from
    const text = (msg.text?.body ?? '').trim()
    const textLower = text.toLowerCase()

    const { data: waNum } = await supabase
      .from('whatsapp_numbers')
      .select('agent_id')
      .eq('phone_number', from)
      .eq('is_active', true)
      .maybeSingle()

    let clientId = null
    let agentId = waNum?.agent_id ?? null

    if (!waNum) {
      const { data: client } = await supabase
        .from('clients')
        .select('id,assigned_agent_id')
        .eq('wa_contact_id', from)
        .maybeSingle()

      if (client) {
        clientId = client.id
        agentId = client.assigned_agent_id
      } else {
        const { data: newClient } = await supabase
          .from('clients')
          .insert({
            full_name: `WhatsApp ${from}`,
            phone: from,
            wa_contact_id: from,
            lead_stage: 'new',
            client_type: 'buyer',
          })
          .select('id')
          .single()
        if (newClient) clientId = newClient.id
      }
    }

    if (clientId) {
      await supabase.from('interactions').insert({
        client_id: clientId,
        agent_id: agentId,
        interaction_type: 'whatsapp',
        content: text,
        direction: 'in',
        summarized: false,
      })

      const { count } = await supabase
        .from('interactions')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('summarized', false)

      if (count && count >= SUMMARIZE_THRESHOLD) {
        triggerSummarization(clientId)
      }
    }

    if (textLower.startsWith('/buscar')) {
      const rawQuery = textLower.replace('/buscar', '').trim()
      if (!rawQuery) {
        await sendWAMessage(from, 'Uso: /buscar [criterios]\nEjemplo: /buscar 3 amb Palermo 200000')
        return { statusCode: 200, body: 'OK' }
      }
      const query = sanitizeLike(rawQuery)
      try {
        const { data: results, error: searchError } = await supabase
          .from('properties')
          .select('id,address,neighborhood,bedrooms,price,operation_type')
          .or(`address.ilike.%${query}%,neighborhood.ilike.%${query}%`)
          .eq('is_active', true)
          .limit(5)
        if (searchError) throw searchError
        if (!results?.length) {
          await sendWAMessage(from, `Sin resultados para "${rawQuery}".`)
          return { statusCode: 200, body: 'OK' }
        }
        const lines = results.map(
          (p, i) => `${i + 1}. ${p.address ?? p.neighborhood} — ${p.bedrooms ?? '?'} amb — $${p.price ?? '?'} (${p.operation_type})`
        )
        await sendWAMessage(from, `${results.length} propiedades encontradas:\n\n${lines.join('\n')}`)
      } catch (err) {
        console.error(`[wa-webhook /buscar "${rawQuery}"] error:`, err.message)
        await sendWAMessage(from, 'Error al buscar. Intentá nuevamente.')
      }
    }

    return { statusCode: 200, body: 'OK' }
  }

  return { statusCode: 405, body: 'Method Not Allowed' }
}
