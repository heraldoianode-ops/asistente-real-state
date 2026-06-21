// PropTech AI Platform — request data completion from the involved advisor (M2, D022)
//
// When a buyer↔offer match has low confidence due to missing data (e.g. m²),
// don't silently degrade: ask the involved advisor to complete it. Offer gaps go
// to the property's listing agent; demand gaps go to the client's assigned agent.
// Returns notify payloads (advisor_id + message); the gateway performs the send.
// Deterministic, zero LLM. Secret-key protected (P008).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { scoreMatch, type Demand, type Offer } from '../_shared/match-scoring.ts'

const DEMAND_COLS =
  'id, assigned_agent_id, full_name, budget, currency, preferred_operation, preferred_neighborhoods, allow_adjacent_zones, min_bedrooms, target_sqm, desired_amenities'
const OFFER_COLS =
  'id, listing_agent_id, title, address, neighborhood, operation_type, accepts_permuta, price, currency, sqm_total, bedrooms, amenities'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { client_id, property_id } = await req.json()
    if (!client_id || !property_id) {
      return json({ error: 'client_id and property_id required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    const { data: c } = await supabase.from('clients').select(DEMAND_COLS).eq('id', client_id).maybeSingle()
    const { data: p } = await supabase.from('properties').select(OFFER_COLS).eq('id', property_id).maybeSingle()
    if (!c || !p) return json({ error: 'client or property not found' }, 404)

    const r = scoreMatch(c as Demand, p as Offer)
    if (!r.passes) return json({ passes: false, reason: r.fail_reasons })
    if (r.gaps.length === 0) {
      return json({ confidence: r.confidence, gaps: [], requests: [], note: 'No faltan datos para el scoring.' })
    }

    // Route gaps: offer -> listing agent, demand -> assigned agent.
    const offerGaps = r.gaps.filter((g) => g.side === 'offer').map((g) => g.label)
    const demandGaps = r.gaps.filter((g) => g.side === 'demand').map((g) => g.label)
    const propLabel = p.title ?? p.address ?? 'la propiedad'

    const requests = []
    if (offerGaps.length && p.listing_agent_id) {
      requests.push({
        advisor_id: p.listing_agent_id,
        about: { type: 'property', id: property_id },
        message:
          `Para mejorar un match de "${propLabel}" faltan datos: ${offerGaps.join(', ')}. ` +
          `¿Podés completarlos? Así afinamos la recomendación.`,
      })
    }
    if (demandGaps.length && c.assigned_agent_id) {
      requests.push({
        advisor_id: c.assigned_agent_id,
        about: { type: 'client', id: client_id },
        message:
          `Para mejorar el match del cliente ${c.full_name ?? ''} faltan datos de su búsqueda: ` +
          `${demandGaps.join(', ')}. ¿Podés completarlos?`,
      })
    }

    return json({ confidence: r.confidence, gaps: r.gaps, requests, total: requests.length })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
