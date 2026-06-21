// PropTech AI Platform — F122 Hidden interlinked-business detection (M2, D021)
//
// Sweeps properties, deduces offer↔demand interlinks (same matcher as F121),
// keeps the HIDDEN ones (a real opt1/opt3 crossing that nobody is working),
// DISCARDS the active ones (handled by F121), records them as link_type='hidden'
// (status 'candidate'), and emits notifications for the martillero + the listing
// advisors of both offer sides. Secret-key protected (P008). No web access.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { matchInterlinksForProperty } from '../_shared/interlink.ts'

const SWEEP_LIMIT = 100

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { property_id } = await req.json().catch(() => ({}))
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    // Seed set: a single property, or a bounded sweep of available listings.
    let seeds: string[]
    if (property_id) {
      seeds = [property_id]
    } else {
      const { data: props } = await supabase.from('properties')
        .select('id').eq('status', 'available')
        .not('embedding', 'is', null).limit(SWEEP_LIMIT)
      seeds = (props ?? []).map((p: { id: string }) => p.id)
    }

    const martillera = (await supabase.from('app_settings')
      .select('value').eq('key', 'wa_martillera').maybeSingle()).data?.value ?? null

    const hidden = []
    for (const pid of seeds) {
      const candidates = (await matchInterlinksForProperty(supabase, pid))
        .filter((c) => !c.active) // DISCARD active (F121 handles those)

      for (const c of candidates) {
        const { data: ins } = await supabase.from('interlink_matches').upsert({
          a_phone: c.a_phone, b_phone: c.b_phone, match_option: c.match_option,
          a_offer_property_id: c.a_offer_property_id, b_offer_property_id: c.b_offer_property_id,
          link_type: 'hidden', similarity: c.similarity, explanation: c.explanation,
          status: 'candidate',
        }, { onConflict: 'a_phone,b_phone,link_type' }).select('id').single()
        if (!ins) continue

        const offerIds = [c.a_offer_property_id, c.b_offer_property_id].filter(Boolean)
        const { data: agents } = await supabase.from('properties')
          .select('listing_agent_id').in('id', offerIds)
        const advisor_ids = [...new Set((agents ?? [])
          .map((a: { listing_agent_id: string | null }) => a.listing_agent_id).filter(Boolean))]

        hidden.push({
          interlink_id: ins.id, match_option: c.match_option,
          a_offer_property_id: c.a_offer_property_id, b_offer_property_id: c.b_offer_property_id,
          explanation: c.explanation,
          notify: { martillera, advisor_ids, message: c.explanation },
        })
      }
    }

    return json({ hidden, total: hidden.length })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
