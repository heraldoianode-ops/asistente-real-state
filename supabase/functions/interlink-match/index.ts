// PropTech AI Platform — F121 Active interlinked-business matching (M2, D021)
//
// Deduces interlinks for a seed property by SEARCHING offer↔demand crossings
// (pgvector additive, free — zero Claude tokens) and records the ACTIVE ones
// (counterparty already being worked on this property). 'candidate' status —
// analyze before validate. Secret-key protected (P008). No web access (D019).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { matchInterlinksForProperty } from '../_shared/interlink.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { property_id } = await req.json()
    if (!property_id) return json({ error: 'property_id required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    const candidates = (await matchInterlinksForProperty(supabase, property_id))
      .filter((c) => c.active)

    const recorded = []
    for (const c of candidates) {
      const { data: ins } = await supabase.from('interlink_matches').upsert({
        a_phone: c.a_phone, b_phone: c.b_phone, match_option: c.match_option,
        a_offer_property_id: c.a_offer_property_id, b_offer_property_id: c.b_offer_property_id,
        link_type: 'active', similarity: c.similarity, explanation: c.explanation,
        status: 'candidate',
      }, { onConflict: 'a_phone,b_phone,link_type' }).select('id').single()
      if (ins) recorded.push({ interlink_id: ins.id, ...c })
    }

    return json({ candidates: recorded, total: recorded.length })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
