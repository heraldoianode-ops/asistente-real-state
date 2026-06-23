// WhatsApp Cloud API gateway as a Supabase Edge Function.
// ES: Reemplaza el gateway Express en VPS — sin dominio ni servidor propio.
// EN: Replaces the Express gateway on a VPS — no domain or own server needed.
//
// Routes (base: /functions/v1/wa-gateway):
//   GET  ?hub.mode=subscribe&…   → Meta webhook verification (WA_VERIFY_TOKEN)
//   GET  /health                 → liveness probe
//   POST /                       → Meta webhook events (optional X-Hub-Signature-256 check via WA_APP_SECRET)
//   POST /send                   → outbound message; requires a Supabase user JWT
//
// Deployed with verify_jwt=false: Meta cannot send a Supabase JWT, so the
// webhook is protected by the verify token + optional HMAC signature instead,
// and /send enforces its own user-token auth below.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WA_VERIFY_TOKEN = Deno.env.get('WA_VERIFY_TOKEN') ?? ''
const WA_TOKEN = Deno.env.get('WA_TOKEN') ?? ''
const WA_PHONE_ID = Deno.env.get('WA_PHONE_NUMBER_ID') ?? ''
const WA_APP_SECRET = Deno.env.get('WA_APP_SECRET') ?? ''
const WA_API_VERSION = Deno.env.get('WA_API_VERSION') ?? 'v21.0'
const SCHEMA = Deno.env.get('WA_SCHEMA') ?? 'asistente_real_state'

// Anon key with RLS — never the service role key here
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { db: { schema: SCHEMA } },
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Sanitize user input for SQL ILIKE to prevent wildcard injection
function sanitizeLike(str: string) {
  return str.replace(/[%_\\]/g, (c) => `\\${c}`)
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  if (!WA_APP_SECRET) return true
  const header = req.headers.get('x-hub-signature-256')
  if (!header?.startsWith('sha256=')) return false
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(WA_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected = 'sha256=' + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return expected === header
}

async function sendMessage(to: string, message: string) {
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

type WebhookBody = {
  entry?: { changes?: { value?: { messages?: { from?: string; timestamp?: string; text?: { body?: string } }[] } }[] }[]
}

async function handleIncoming(body: WebhookBody | null) {
  const entry = body?.entry?.[0]?.changes?.[0]?.value
  if (!entry?.messages?.length) return
  const msg = entry.messages[0]
  if (!msg?.timestamp || !msg.from) return
  const from = msg.from
  const text = (msg.text?.body ?? '').trim().toLowerCase()
  if (!text.startsWith('/buscar')) return
  const rawQuery = text.replace('/buscar', '').trim()
  if (!rawQuery) {
    await sendMessage(from, 'Uso: /buscar [criterios]\nEjemplo: /buscar 3 amb Palermo 200000')
    return
  }
  const query = sanitizeLike(rawQuery)
  try {
    const { data: waNum } = await supabase
      .from('whatsapp_numbers')
      .select('agent_id')
      .eq('phone_number', from)
      .eq('is_active', true)
      .maybeSingle()
    if (!waNum) { await sendMessage(from, 'Tu número no está registrado.'); return }
    const { data: results, error: searchError } = await supabase
      .from('properties')
      .select('id,address,neighborhood,bedrooms,price,operation_type')
      .or(`address.ilike.%${query}%,neighborhood.ilike.%${query}%`)
      .eq('status', 'available')
      .limit(5)
    if (searchError) throw searchError
    if (!results?.length) { await sendMessage(from, `Sin resultados para "${rawQuery}".`); return }
    const lines = results.map((p, i) =>
      `${i + 1}. ${p.address ?? p.neighborhood} — ${p.bedrooms ?? '?'} amb — $${p.price ?? '?'} (${p.operation_type})`
    )
    await sendMessage(from, `${results.length} propiedades encontradas:\n\n${lines.join('\n')}`)
  } catch (err) {
    console.error(`[wa-gateway /buscar "${rawQuery}"] error:`, err instanceof Error ? err.message : err)
    await sendMessage(from, 'Error al buscar. Intentá nuevamente.')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = new URL(req.url)
  const sub = url.pathname.replace(/\/+$/, '').split('/').pop()

  if (req.method === 'GET') {
    if (sub === 'health') return json({ ok: true })
    if (
      url.searchParams.get('hub.mode') === 'subscribe' &&
      WA_VERIFY_TOKEN &&
      url.searchParams.get('hub.verify_token') === WA_VERIFY_TOKEN
    ) {
      return new Response(url.searchParams.get('hub.challenge') ?? '', { headers: corsHeaders })
    }
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  if (sub === 'send') {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return json({ error: 'Unauthorized' }, 401)
    // Trusted internal callers (e.g. notify-agent) authenticate with the service-role key;
    // everyone else must present a valid Supabase user JWT.
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!(serviceKey && token === serviceKey)) {
      const { data: { user } } = await supabase.auth.getUser(token)
      if (!user) return json({ error: 'Unauthorized' }, 401)
    }
    let payload: { to?: string; message?: string }
    try { payload = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
    const { to, message } = payload ?? {}
    if (!to || !message) return json({ error: 'to and message required' }, 400)
    try {
      await sendMessage(to, message)
      return json({ ok: true })
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Error' }, 500)
    }
  }

  // Meta webhook: ack immediately, process in background
  const raw = await req.text()
  if (!(await verifySignature(req, raw))) return new Response('Invalid signature', { status: 401, headers: corsHeaders })
  let body: WebhookBody | null = null
  try { body = JSON.parse(raw) } catch { /* non-JSON pings are acked */ }
  const task = handleIncoming(body).catch((err) =>
    console.error('[wa-gateway] webhook error:', err instanceof Error ? err.message : err))
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
  if (runtime?.waitUntil) runtime.waitUntil(task)
  else await task
  return new Response('OK', { headers: corsHeaders })
})
