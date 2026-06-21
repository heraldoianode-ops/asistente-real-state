// PropTech AI Platform — F113/F114 context derivations (M1)
//
// Derives non-bot contexts to a dedicated personal WhatsApp number:
//   tramites   -> wa_martillera  (F113, misc paperwork → la martillera)
//   inquilinos -> wa_alquileres  (F114, tenants/renters → área de alquileres)
// Deterministic handoff (no LLM, zero cost). The gateway performs the actual
// WhatsApp send using `derive_to` + `handoff`. Secret-key protected (P008).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'

const TARGETS: Record<string, { setting: string; area: string; team: string }> = {
  tramites: { setting: 'wa_martillera', area: 'trámites', team: 'la martillera' },
  inquilinos: { setting: 'wa_alquileres', area: 'alquileres', team: 'el área de alquileres' },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { contact_phone, message, context } = await req.json()
    if (!contact_phone || !context) {
      return json({ error: 'contact_phone and context required' }, 400)
    }
    const target = TARGETS[context]
    if (!target) {
      return json({ error: `context must be one of ${Object.keys(TARGETS).join(', ')}` }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )
    const { data: s } = await supabase.from('app_settings')
      .select('value').eq('key', target.setting).maybeSingle()
    const deriveTo = s?.value ?? null

    const handoff =
      `Derivación (${target.area}) — contacto ${contact_phone}: ` +
      `"${(message ?? '').toString().slice(0, 500)}"`

    const reply = deriveTo
      ? `Te derivo con ${target.team}; en breve se comunican con vos. 🙌`
      : `Estoy derivando tu consulta de ${target.area}; el equipo te contactará a la brevedad.`

    return json({
      context,
      derive_to: deriveTo,
      configured: deriveTo !== null,
      handoff,
      reply,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
