// PropTech AI Platform — interlinked-business matcher (D021 + D022).
//
// Deduces interlinks by SEARCHING offer↔demand crossings with pgvector (additive,
// free) and then VALIDATES each crossing with the strict matching rules (D022:
// mandatory budget/zone/operation filters + affinity score). Seeded from a
// property (an OFERTA):
//   opt1: this property's offer satisfies another party's demand
//   opt3: AND that party offers something matching THIS owner's demand (reciprocal)
//   opt2 is opt1 seen from the counterpart property — covered by sweeping all.
// Permuta cruzada is flagged when an opt3 link involves a permuta-enabled offer.
import { scoreMatch, type Demand, type Offer } from './match-scoring.ts'

const THRESHOLD = 0.72

export type MatchOption = 'opt1' | 'opt3'
export interface InterlinkCandidate {
  a_phone: string
  b_phone: string
  match_option: MatchOption
  a_offer_property_id: string
  b_offer_property_id: string | null
  similarity: number
  active: boolean
  permuta_cruzada: boolean
  explanation: string
}

const OFFER_COLS =
  'id, listing_agent_id, title, address, neighborhood, operation_type, accepts_permuta, price, currency, sqm_total, bedrooms, amenities, embedding'
const DEMAND_COLS =
  'id, phone, wa_contact_id, budget, currency, preferred_operation, preferred_neighborhoods, allow_adjacent_zones, min_bedrooms, target_sqm, desired_amenities, preference_embedding'

// deno-lint-ignore no-explicit-any
export async function matchInterlinksForProperty(supabase: any, propertyId: string): Promise<InterlinkCandidate[]> {
  const { data: prop } = await supabase.from('properties').select(OFFER_COLS).eq('id', propertyId).maybeSingle()
  if (!prop?.embedding) return []
  const offerA = prop as Offer & { accepts_permuta?: boolean }

  // Party A = owner of this property (its OFERTA).
  const { data: ownerRow } = await supabase.from('property_owner_contacts')
    .select('phone, owner_name').eq('property_id', propertyId)
    .not('phone', 'is', null).limit(1).maybeSingle()
  const aPhone: string = ownerRow?.phone ?? `prop:${propertyId}`

  // A's DEMANDA (A as buyer), if registered — for opt3 reciprocity.
  let aDemand: unknown = null
  if (ownerRow?.phone) {
    const { data: aClient } = await supabase.from('clients')
      .select('preference_embedding').eq('phone', ownerRow.phone)
      .not('preference_embedding', 'is', null).maybeSingle()
    aDemand = aClient?.preference_embedding ?? null
  }

  // opt1 seed: parties B whose DEMANDA is semantically satisfied by A's OFERTA.
  const { data: matches } = await supabase.rpc('find_cross_agent_matches', {
    p_property_id: propertyId,
    p_embedding: prop.embedding,
    p_listing_agent_id: prop.listing_agent_id,
    p_threshold: THRESHOLD,
  })

  const out: InterlinkCandidate[] = []
  for (const m of (matches ?? [])) {
    const { data: bClient } = await supabase.from('clients').select(DEMAND_COLS).eq('id', m.client_id).maybeSingle()
    if (!bClient) continue
    const bPhone: string = bClient.phone ?? bClient.wa_contact_id ?? `client:${m.client_id}`
    if (bPhone === aPhone) continue // same party is not an interlink

    // D022 strict validation: B's demand vs A's offer must pass mandatory filters.
    const sc = scoreMatch(bClient as Demand, offerA)
    if (!sc.passes) continue

    // opt3: does B offer something matching A's DEMANDA? (reciprocal)
    let bOffer: string | null = null
    if (aDemand && bClient.phone) {
      const { data: recip } = await supabase.rpc('find_offers_for_demand', {
        p_embedding: aDemand, p_owner_phone: bClient.phone, p_threshold: THRESHOLD,
      })
      bOffer = recip?.[0]?.property_id ?? null
    }
    const option: MatchOption = bOffer ? 'opt3' : 'opt1'
    const permutaCruzada = option === 'opt3' && offerA.accepts_permuta === true

    const { count } = await supabase.from('events')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', m.client_id).eq('property_id', propertyId)
    const active = (count ?? 0) > 0

    const head = option === 'opt3'
      ? `Negocio entrelazado RECÍPROCO (opción 3) con ${m.client_name}${permutaCruzada ? ' — Posible Permuta Cruzada' : ''}.`
      : `Negocio entrelazado (opción 1): la oferta satisface la demanda de ${m.client_name}.`

    out.push({
      a_phone: aPhone, b_phone: bPhone, match_option: option,
      a_offer_property_id: propertyId, b_offer_property_id: bOffer,
      similarity: sc.score / 100, active, permuta_cruzada: permutaCruzada,
      explanation: `${head} ${sc.explanation}`,
    })
  }
  return out
}
