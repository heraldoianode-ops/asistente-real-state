// PropTech AI Platform — F110 Context classifier / router (M1)
//
// Classifies an incoming WhatsApp message into one of 5 conversational contexts
// and returns how to handle it. Classification runs on the FREE tier (Ollama via
// the LLM router) — zero Claude tokens (P006). Secret-key protected (P008).
//
//   ventas      -> Ventas/Dueños: property status reports        (F111, internal)
//   compras     -> Compras/Interesados: advisory + visits        (F112, internal)
//   tramites    -> Trámites varios: derive to martillera WhatsApp (F113, wa_martillera)
//   inquilinos  -> Inquilinos/Arrendatarios: derive to rentals    (F114, wa_alquileres)
//   ia          -> Independent IA + meta-learning                 (F115, internal)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { runLLM } from '../_shared/llm-router.ts'

type Context = 'ventas' | 'compras' | 'tramites' | 'inquilinos' | 'ia'
const CONTEXTS: Context[] = ['ventas', 'compras', 'tramites', 'inquilinos', 'ia']

const SYSTEM =
  'Clasificás mensajes de WhatsApp de una inmobiliaria en EXACTAMENTE una categoría. ' +
  'Respondé SOLO una palabra, sin explicación:\n' +
  '- ventas: un dueño/propietario consulta por su propiedad en venta o su estado.\n' +
  '- compras: un interesado quiere comprar, pide info de una propiedad o agendar visita.\n' +
  '- tramites: trámites/documentación/escrituras/gestiones varias.\n' +
  '- inquilinos: temas de alquiler, inquilinos o arrendatarios.\n' +
  '- ia: saludo, charla general o pedido al asistente que no encaja en las otras.'

// Heuristic fallback keeps classification working if the LLM is unavailable.
function heuristic(msg: string): Context {
  const t = msg.toLowerCase()
  if (/\b(alquil|inquilin|arrend|locaci[oó]n|garant[ií]a)\b/.test(t)) return 'inquilinos'
  if (/\b(tr[aá]mite|escritura|documenta|gesti[oó]n|impuesto|sucesi[oó]n)\b/.test(t)) return 'tramites'
  if (/\b(vendo|mi propiedad|mi casa|mi depto|en venta|tasaci[oó]n|c[oó]mo va)\b/.test(t)) return 'ventas'
  if (/\b(comprar|me interesa|visita|ver la|precio|cu[aá]nto|disponible)\b/.test(t)) return 'compras'
  return 'ia'
}

function normalize(raw: string): Context | null {
  const w = raw.toLowerCase().trim().replace(/[^a-záéíóú]/g, '')
  return (CONTEXTS as string[]).includes(w) ? (w as Context) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { contact_phone, message } = await req.json()
    if (!contact_phone || !message) {
      return json({ error: 'contact_phone, message required' }, 400)
    }

    // Free tier classify (Ollama). adminRequest false → Claude never used.
    let context = heuristic(message)
    try {
      const result = await runLLM({
        messages: [{ role: 'user', content: message }],
        system: SYSTEM,
        complexity: 'simple',
        maxTokens: 4,
      })
      context = normalize(result.text) ?? context
    } catch {
      // keep heuristic result on LLM failure
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    await supabase.from('chat_conversations')
      .upsert({ contact_phone, context, updated_at: new Date().toISOString() },
              { onConflict: 'contact_phone' })

    // Resolve derivation target for contexts the bot does not handle directly.
    let route: { handler: 'internal' | 'derive'; derive_to?: string | null; setting?: string } =
      { handler: 'internal' }
    if (context === 'tramites' || context === 'inquilinos') {
      const settingKey = context === 'tramites' ? 'wa_martillera' : 'wa_alquileres'
      const { data: s } = await supabase.from('app_settings')
        .select('value').eq('key', settingKey).maybeSingle()
      route = { handler: 'derive', derive_to: s?.value ?? null, setting: settingKey }
    }

    return json({ context, route })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
