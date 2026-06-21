// PropTech AI Platform — F112 Compras/Interesados: advisory + visit requests (M1)
//
// Advises interested buyers grounded ONLY on stored property data (free tier,
// Ollama via router — zero Claude tokens, P006) and registers visit requests as
// PENDING. A visit is never booked here: it stays 'pending_advisor' until the
// advisor explicitly confirms it via confirm-visit (pattern P009). No web access.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { runLLM } from '../_shared/llm-router.ts'

const VISIT_INTENT = /\b(visita|visitar|ver la|conocer|agendar|cita|cu[aá]ndo puedo|coordinar)\b/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { contact_phone, message, property_id, action, proposed_at } = await req.json()
    if (!contact_phone || (!message && action !== 'request_visit')) {
      return json({ error: 'contact_phone and message required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    const wantsVisit = action === 'request_visit' || (message && VISIT_INTENT.test(message))

    // --- Visit request path (P009: register as pending, do NOT book) ---------
    if (wantsVisit) {
      if (!property_id) {
        return json({ reply: '¿Sobre qué propiedad querés coordinar la visita? Pasame el aviso o la dirección.', needs: 'property_id' })
      }
      const { data: prop } = await supabase.from('properties')
        .select('id, address, listing_agent_id').eq('id', property_id).maybeSingle()
      if (!prop) return json({ error: 'property not found' }, 404)

      const client = await findOrCreateClient(supabase, contact_phone)
      const { data: ev } = await supabase.from('events').insert({
        client_id: client.id,
        agent_id: prop.listing_agent_id,
        property_id: prop.id,
        event_type: 'visita',
        status: 'pending_advisor', // NOT booked until advisor confirms (P009)
        scheduled_at: proposed_at ?? new Date().toISOString(),
        notes: `Solicitud de visita por WhatsApp. ${proposed_at ? `Propuesto: ${proposed_at}. ` : ''}PENDIENTE confirmación del asesor.`,
      }).select('id').single()

      return json({
        status: 'pending_advisor',
        event_id: ev?.id,
        reply: 'Registré tu solicitud de visita. Queda pendiente de confirmación del asesor; te aviso apenas la confirme.',
      })
    }

    // --- Advisory path (grounded, free tier) ---------------------------------
    let propertyContext = ''
    if (property_id) {
      const { data: p } = await supabase.from('properties')
        .select('title, address, neighborhood, city, property_type, operation_type, status, price, currency, sqm_total, sqm_covered, bedrooms, bathrooms, parking, amenities, description')
        .eq('id', property_id).maybeSingle()
      if (p) propertyContext = JSON.stringify(p)
    }

    const system =
      'Sos un asesor inmobiliario. Respondé SOLO con los datos provistos de la ' +
      'propiedad; si falta un dato, decí que lo consultás, no inventes. Si el ' +
      'interesado quiere visitar, aclarale que la visita requiere confirmación del ' +
      'asesor. Tono cordial y breve.'
    const userPrompt = propertyContext
      ? `Datos de la propiedad:\n${propertyContext}\n\nConsulta del interesado:\n${message}`
      : `Consulta del interesado (sin propiedad asociada):\n${message}`

    const result = await runLLM({
      messages: [{ role: 'user', content: userPrompt }],
      system,
      complexity: 'simple',
      maxTokens: 400,
    })

    return json({ status: 'advisory', reply: result.text })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function findOrCreateClient(supabase: any, phone: string) {
  const { data: existing } = await supabase.from('clients')
    .select('id').or(`phone.eq.${phone},wa_contact_id.eq.${phone}`).maybeSingle()
  if (existing) return existing
  const { data: created } = await supabase.from('clients')
    .insert({ full_name: `Contacto ${phone}`, phone, wa_contact_id: phone, client_type: 'buyer' })
    .select('id').single()
  return created
}
