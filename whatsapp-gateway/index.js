const express = require('express')
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(express.json({ limit: '1mb' }))

// ─── Startup env validation ───────────────────────────────────────────────────
const REQUIRED_VARS = ['WA_VERIFY_TOKEN', 'WA_TOKEN', 'WA_PHONE_NUMBER_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const v of REQUIRED_VARS) {
  if (!process.env[v]) {
    console.error(`[whatsapp-gateway] FATAL: missing required env var ${v}`)
    process.exit(1)
  }
}

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN
const WA_TOKEN    = process.env.WA_TOKEN
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

app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN)
    res.send(req.query['hub.challenge'])
  else res.sendStatus(403)
})

app.post('/webhook', async (req, res) => {
  res.sendStatus(200)
  const entry = req.body?.entry?.[0]?.changes?.[0]?.value
  if (!entry?.messages?.length) return
  const msg = entry.messages[0]
  if (!msg?.timestamp) return
  const from = msg.from
  const text = (msg.text?.body ?? '').trim()
  const textLower = text.toLowerCase()

  // Lookup agent by WA number
  const { data: waNum } = await supabase
    .from('whatsapp_numbers')
    .select('agent_id')
    .eq('phone_number', from)
    .eq('is_active', true)
    .maybeSingle()

  // Find or create client by wa_contact_id
  let clientId = null
  let agentId = waNum?.agent_id ?? null

  if (!waNum) {
    // Sender is a client (not a registered agent)
    const { data: client } = await supabase
      .from('clients')
      .select('id,assigned_agent_id')
      .eq('wa_contact_id', from)
      .maybeSingle()

    if (client) {
      clientId = client.id
      agentId = client.assigned_agent_id
    } else {
      // Auto-create client record for new WhatsApp contacts
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

  // Store interaction
  if (clientId) {
    await supabase.from('interactions').insert({
      client_id: clientId,
      agent_id: agentId,
      interaction_type: 'whatsapp',
      content: text,
      direction: 'in',
      summarized: false,
    })

    // Check if summarization threshold reached
    const { count } = await supabase
      .from('interactions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('summarized', false)

    if (count && count >= SUMMARIZE_THRESHOLD) {
      triggerSummarization(clientId)
    }
  }

  // Handle /buscar command
  if (textLower.startsWith('/buscar')) {
    const rawQuery = textLower.replace('/buscar', '').trim()
    if (!rawQuery) {
      await sendMessage(from, 'Uso: /buscar [criterios]\nEjemplo: /buscar 3 amb Palermo 200000')
      return
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
      if (!results?.length) { await sendMessage(from, `Sin resultados para "${rawQuery}".`); return }
      const lines = results.map((p, i) =>
        `${i + 1}. ${p.address ?? p.neighborhood} — ${p.bedrooms ?? '?'} amb — $${p.price ?? '?'} (${p.operation_type})`
      )
      await sendMessage(from, `${results.length} propiedades encontradas:\n\n${lines.join('\n')}`)
    } catch (err) {
      console.error(`[whatsapp-gateway /buscar "${rawQuery}"] error:`, err.message)
      await sendMessage(from, 'Error al buscar. Intentá nuevamente.')
    }
  }
})

app.post('/send', async (req, res) => {
  const { to, message } = req.body
  if (!to || !message) return res.status(400).json({ error: 'to and message required' })
  try {
    const ok = await sendMessage(to, message)
    res.json({ ok })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' })
  }
})

app.post('/summarize', async (req, res) => {
  const { client_id } = req.body
  if (!client_id) return res.status(400).json({ error: 'client_id required' })
  try {
    const result = await triggerSummarization(client_id)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' })
  }
})

app.get('/health', (_req, res) => res.json({ ok: true }))

async function sendMessage(to, message) {
  const r = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ client_id: clientId }),
    })
    const result = await res.json()
    console.log(`[whatsapp-gateway] Summarization for client ${clientId}:`, result)
    return result
  } catch (err) {
    console.error(`[whatsapp-gateway] Summarization error for client ${clientId}:`, err.message)
    return { ok: false, error: err.message }
  }
}

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => console.log(`[whatsapp-gateway] Listening on :${PORT}`))
