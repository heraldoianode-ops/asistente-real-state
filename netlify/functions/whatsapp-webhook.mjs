import { createClient } from '@supabase/supabase-js'

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN
const WA_TOKEN = process.env.WA_TOKEN
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID
const WA_API_VERSION = process.env.WA_API_VERSION || 'v21.0'
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SCHEMA = process.env.SUPABASE_SCHEMA || 'asistente_real_state'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: SCHEMA } })

function sanitizeLike(str) {
  return str.replace(/[%_\\]/g, (c) => `\\${c}`)
}

async function sendMessage(to, message) {
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

async function handleMessage(msg) {
  const from = msg.from
  const text = (msg.text?.body ?? '').trim().toLowerCase()
  if (!text.startsWith('/buscar')) return

  const rawQuery = text.replace('/buscar', '').trim()
  if (!rawQuery) {
    await sendMessage(from, 'Uso: /buscar [criterios]\nEjemplo: /buscar 3 amb Palermo 200000')
    return
  }

  const query = sanitizeLike(rawQuery)
  const { data: waNum } = await supabase
    .from('whatsapp_numbers')
    .select('agent_id')
    .eq('phone_number', from)
    .eq('is_active', true)
    .maybeSingle()

  if (!waNum) {
    await sendMessage(from, 'Tu número no está registrado.')
    return
  }

  const { data: results, error: searchError } = await supabase
    .from('properties')
    .select('id,address,neighborhood,bedrooms,price,operation_type')
    .or(`address.ilike.%${query}%,neighborhood.ilike.%${query}%`)
    .eq('is_active', true)
    .limit(5)

  if (searchError) throw searchError

  if (!results?.length) {
    await sendMessage(from, `Sin resultados para "${rawQuery}".`)
    return
  }

  const lines = results.map((p, i) =>
    `${i + 1}. ${p.address ?? p.neighborhood} — ${p.bedrooms ?? '?'} amb — $${p.price ?? '?'} (${p.operation_type})`
  )
  await sendMessage(from, `${results.length} propiedades encontradas:\n\n${lines.join('\n')}`)
}

// GET = Meta webhook verification
// POST = incoming WhatsApp messages
export default async (req, context) => {
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      const entry = body?.entry?.[0]?.changes?.[0]?.value
      if (entry?.messages?.length) {
        const msg = entry.messages[0]
        if (msg?.timestamp) {
          await handleMessage(msg)
        }
      }
    } catch (err) {
      console.error('[whatsapp-webhook]', err.message)
    }
    return new Response('OK', { status: 200 })
  }

  return new Response('Method not allowed', { status: 405 })
}

export const config = {
  path: '/api/whatsapp-webhook',
}
