// PropTech AI Platform — buyer offer recommendations (M2, D022)
//
// For a buyer (client), applies the strict matching rules (mandatory filters +
// affinity scoring + permuta logic) over available offers and returns a list
// ordered HIGH→LOW score with a short per-property explanation for the human
// agent. Deterministic, zero LLM (free). pgvector remains the additive discovery
// layer (interlink); here the authoritative rules apply. Secret-key (P008).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { scoreMatch, type Demand, type Offer } from '../_shared/match-scoring.ts'

const CANDIDATE_LIMIT = 200

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { client_id } = await req.json()
    if (!client_id) return json({ error: 'client_id required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    const { data: c } = await supabase.from('clients')
      .select('id, budget, currency, preferred_operation, preferred_neighborhoods, allow_adjacent_zones, min_bedrooms, target_sqm, desired_amenities')
      .eq('id', client_id).maybeSingle()
    if (!c) return json({ error: 'client not found' }, 404)
    const demand = c as Demand

    // Candidate offers: available listings (mandatory filters applied in scoring).
    const { data: props } = await supabase.from('properties')
      .select('id, title, address, neighborhood, operation_type, accepts_permuta, status, price, currency, sqm_total, bedrooms, amenities')
      .eq('status', 'available').limit(CANDIDATE_LIMIT)

    const ranked = []
    for (const p of (props ?? [])) {
      const r = scoreMatch(demand, p as Offer)
      if (!r.passes) continue
      ranked.push({
        property_id: p.id,
        score: r.score,
        classification: r.classification,
        permuta_possible: r.permuta_possible,
        explanation: r.explanation,
      })
    }
    ranked.sort((a, b) => b.score - a.score)

    return json({ client_id, total: ranked.length, recommendations: ranked })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
