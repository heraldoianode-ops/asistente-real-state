const express = require('express')
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(express.json())

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN
const WA_TOKEN    = process.env.WA_TOKEN
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'asistente_real_state' } })

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
  const from = msg.from
  const text = (msg.text?.body ?? '').trim().toLowerCase()
  if (!text.startsWith('/buscar')) return
  const query = text.replace('/buscar', '').trim()
  if (!query) { await sendMessage(from, 'Uso: /buscar [criterios]\nEjemplo: /buscar 3 amb Palermo 200000'); return }
  try {
    const { data: waNum } = await supabase.from('whatsapp_numbers').select('agent_id').eq('phone_number', from).eq('is_active', true).maybeSingle()
    if (!waNum) { await sendMessage(from, 'Tu número no está registrado.'); return }
    const { data: results } = await supabase.from('properties').select('id,address,neighborhood,bedrooms,price,operation_type').or(`address.ilike.%${query}%,neighborhood.ilike.%${query}%`).eq('is_active', true).limit(5)
    if (!results?.length) { await sendMessage(from, `Sin resultados para "${query}".`); return }
    const lines = results.map((p, i) => `${i+1}. ${p.address??p.neighborhood} — ${p.bedrooms??'?'} amb — $${p.price??'?'} (${p.operation_type})`)
    await sendMessage(from, `${results.length} propiedades encontradas:\n\n${lines.join('\n')}`)
  } catch (err) { console.error(err); await sendMessage(from, 'Error al buscar.') }
})

app.post('/send', async (req, res) => {
  const { to, message } = req.body
  if (!to || !message) return res.status(400).json({ error: 'to and message required' })
  try { res.json({ ok: await sendMessage(to, message) }) }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'Error' }) }
})

app.get('/health', (_req, res) => res.json({ ok: true }))

async function sendMessage(to, message) {
  const r = await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
  })
  return r.ok
}

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => console.log(`WhatsApp Gateway :${PORT}`))
