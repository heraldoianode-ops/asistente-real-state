import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SCHEMA = 'asistente_real_state'
const MAX_HISTORY = 20
const MAX_SEARCH_RESULTS = 5

const SYSTEM_PROMPT = `Sos VALKIRYA, asistente inteligente de bienes raíces de Solernou Propiedades.
Tu rol es ayudar a clientes y agentes inmobiliarios por WhatsApp.

Capacidades:
- Buscar propiedades por zona, precio, ambientes, tipo de operación (venta/alquiler)
- Responder consultas sobre propiedades listadas
- Agendar visitas y llamadas
- Derivar a un agente humano cuando sea necesario

Reglas:
- Respondé siempre en español argentino, tono profesional pero cercano
- Sé conciso: WhatsApp no es lugar para textos largos
- Si no tenés info suficiente, preguntá al usuario antes de inventar
- Si el usuario pide hablar con una persona, respondé con ESCALAR
- Nunca inventés propiedades que no estén en los resultados de búsqueda
- Usá emojis con moderación (máx 1-2 por mensaje)
- Si te mandan audio o imagen, avisá que por ahora solo procesás texto`

interface PropertyResult {
  id: string
  address: string
  neighborhood: string | null
  bedrooms: number | null
  bathrooms: number | null
  price: number
  currency: string
  operation_type: string
  property_type: string
  sqm_total: number | null
  description: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { phone_number, message, agent_id } = await req.json()
    if (!phone_number || !message) {
      return jsonResponse({ error: 'phone_number and message required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: SCHEMA } }
    )

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500)

    await supabase.from('wa_conversations').insert({
      phone_number,
      agent_id: agent_id || null,
      role: 'user',
      content: message,
    })

    const { data: history } = await supabase
      .from('wa_conversations')
      .select('role, content')
      .eq('phone_number', phone_number)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY)

    const messages = (history ?? []).reverse().map((h: { role: string; content: string }) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    }))

    const propertyContext = await searchRelevantProperties(supabase, message)

    let systemPrompt = SYSTEM_PROMPT
    if (propertyContext) {
      systemPrompt += `\n\nPropiedades encontradas relevantes al mensaje del usuario:\n${propertyContext}`
    }

    const reply = await callClaude(anthropicKey, systemPrompt, messages)

    await supabase.from('wa_conversations').insert({
      phone_number,
      agent_id: agent_id || null,
      role: 'assistant',
      content: reply,
    })

    if (agent_id) {
      await supabase.from('interactions').insert({
        client_id: await findOrCreateClient(supabase, phone_number, agent_id),
        agent_id,
        interaction_type: 'whatsapp',
        content: `User: ${message}\nValkirya: ${reply}`,
        direction: 'inbound',
      })
    }

    return jsonResponse({ reply, escalate: reply.includes('ESCALAR') })
  } catch (err) {
    console.error('[chat-agent] error:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500
    )
  }
})

async function searchRelevantProperties(
  supabase: ReturnType<typeof createClient>,
  message: string
): Promise<string | null> {
  const keywords = extractSearchTerms(message)
  if (!keywords) return null

  let query = supabase
    .from('properties')
    .select('id, address, neighborhood, bedrooms, bathrooms, price, currency, operation_type, property_type, sqm_total, description')
    .eq('is_active', true)
    .limit(MAX_SEARCH_RESULTS)

  const priceMatch = message.match(/(\d{3,})/g)
  if (priceMatch) {
    const maxPrice = Math.max(...priceMatch.map(Number))
    if (maxPrice >= 1000) query = query.lte('price', maxPrice * 1.2)
  }

  const bedroomMatch = message.match(/(\d)\s*(?:amb|ambiente|dormitorio|habitaci)/i)
  if (bedroomMatch) query = query.gte('bedrooms', parseInt(bedroomMatch[1]))

  if (/alquil|rent/i.test(message)) query = query.eq('operation_type', 'rent')
  else if (/vent|compr/i.test(message)) query = query.eq('operation_type', 'sale')

  if (keywords) {
    query = query.or(
      `address.ilike.%${sanitizeLike(keywords)}%,neighborhood.ilike.%${sanitizeLike(keywords)}%`
    )
  }

  const { data: results } = await query

  if (!results?.length) return null

  return (results as PropertyResult[])
    .map(
      (p, i) =>
        `${i + 1}. ${p.address}${p.neighborhood ? ` (${p.neighborhood})` : ''} — ${p.bedrooms ?? '?'} amb, ${p.bathrooms ?? '?'} baños — ${p.currency}$${p.price} (${p.operation_type === 'rent' ? 'Alquiler' : 'Venta'}) — ${p.property_type} — ${p.sqm_total ? p.sqm_total + 'm²' : ''}`
    )
    .join('\n')
}

function extractSearchTerms(message: string): string | null {
  const neighborhoods = [
    'palermo', 'belgrano', 'recoleta', 'caballito', 'nuñez', 'colegiales',
    'villa urquiza', 'villa crespo', 'almagro', 'san telmo', 'barracas',
    'flores', 'devoto', 'saavedra', 'coghlan', 'chacarita', 'paternal',
    'centro', 'microcentro', 'retiro', 'puerto madero', 'la boca',
    'parque patricios', 'boedo', 'san cristobal', 'monserrat', 'constitución',
    'balvanera', 'once', 'tribunales', 'congreso',
  ]
  const lower = message.toLowerCase()
  const found = neighborhoods.find((n) => lower.includes(n))
  if (found) return found

  const cleaned = lower
    .replace(/[¿?!¡.,]/g, '')
    .replace(/\b(hola|buen[oa]s?|busco|quiero|necesito|tenes|tienen|hay|me|un[oa]?|el|la|los|las|de|en|por|para|con|que|como)\b/g, '')
    .trim()
  return cleaned.length > 2 ? cleaned : null
}

function sanitizeLike(str: string): string {
  return str.replace(/[%_\\]/g, (c) => `\\${c}`)
}

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Claude API ${res.status}: ${body?.error?.message ?? res.statusText}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text ?? 'No pude generar una respuesta. Por favor intentá de nuevo.'
}

async function findOrCreateClient(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  agentId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('wa_contact_id', phone)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created } = await supabase
    .from('clients')
    .insert({
      full_name: `WhatsApp ${phone}`,
      phone,
      wa_contact_id: phone,
      lead_stage: 'new',
      assigned_agent_id: agentId,
    })
    .select('id')
    .single()

  return created!.id
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
