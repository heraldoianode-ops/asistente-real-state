const express = require('express')
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(express.json({ limit: '1mb' }))

// ─── Startup env validation ───────────────────────────────────────────────────
const REQUIRED_VARS = ['WA_VERIFY_TOKEN', 'WA_TOKEN', 'WA_PHONE_NUMBER_ID', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']
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
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCHEMA = process.env.SUPABASE_SCHEMA || 'asistente_real_state'
const WA_API_VERSION = process.env.WA_API_VERSION || 'v21.0'
const CHAT_AGENT_URL = `${SUPABASE_URL}/functions/v1/chat-agent`

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
  if (!text) return

  try {
    const { data: waNum } = await supabase
      .from('whatsapp_numbers')
      .select('agent_id')
      .eq('phone_number', from)
      .eq('is_active', true)
      .maybeSingle()

    if (text.toLowerCase() === 'escalar' || text.toLowerCase() === 'agente') {
      await sendMessage(from, '🤝 Te conecto con un agente humano. En breve te contactarán.')
      return
    }

    if (text.toLowerCase().startsWith('/buscar')) {
      await handleBuscar(from, text, waNum?.agent_id)
      return
    }

    await handleChatAgent(from, text, waNum?.agent_id)
  } catch (err) {
    console.error(`[whatsapp-gateway] error processing message from ${from}:`, err.message)
    await sendMessage(from, 'Hubo un error procesando tu mensaje. Por favor intentá de nuevo.')
  }
})

async function handleBuscar(from, text, agentId) {
  const rawQuery = text.replace(/^\/buscar\s*/i, '').trim()
  if (!rawQuery) {
    await sendMessage(from, 'Uso: /buscar [criterios]\nEjemplo: /buscar 3 amb Palermo 200000')
    return
  }
  const query = sanitizeLike(rawQuery)
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
}

async function handleChatAgent(from, text, agentId) {
  if (!SUPABASE_SERVICE_KEY) {
    await sendMessage(from, 'El asistente AI no está configurado aún. Usá /buscar para buscar propiedades.')
    return
  }

  const response = await fetch(CHAT_AGENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      phone_number: from,
      message: text,
      agent_id: agentId || null,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    console.error(`[chat-agent] error ${response.status}:`, body)
    await sendMessage(from, 'No pude procesar tu mensaje. Intentá de nuevo o escribí /buscar.')
    return
  }

  const { reply, escalate } = await response.json()

  if (escalate) {
    await sendMessage(from, '🤝 Te conecto con un agente humano. En breve te contactarán.')
    return
  }

  await sendMessage(from, reply)
}

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

app.get('/health', (_req, res) => res.json({ ok: true, agent: !!SUPABASE_SERVICE_KEY }))

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

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => console.log(`[whatsapp-gateway] Listening on :${PORT} — AI agent: ${!!SUPABASE_SERVICE_KEY}`))
