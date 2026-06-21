// PropTech AI Platform — interlinked-business matcher (D021).
//
// Deduces interlinks by SEARCHING offer↔demand crossings with pgvector (additive,
// free, Ollama embeddings — zero Claude tokens). Seeded from a property (an OFERTA):
//   opt1: this property's offer satisfies another party's demand (find_cross_agent_matches)
//   opt3: AND that party offers something matching THIS owner's demand (find_offers_for_demand)
//   opt2 is opt1 seen from the counterpart property — covered by sweeping all properties.
//
// Each candidate is also classified active vs hidden: active when the counterparty
// is already being worked on this property (an event exists), else hidden.

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
  explanation: string
}

// deno-lint-ignore no-explicit-any
export async function matchInterlinksForProperty(supabase: any, propertyId: string): Promise<InterlinkCandidate[]> {
  const { data: prop } = await supabase.from('properties')
    .select('id, listing_agent_id, neighborhood, embedding').eq('id', propertyId).maybeSingle()
  if (!prop?.embedding) return []

  // Party A = owner of this property (its OFERTA).
  const { data: ownerRow } = await supabase.from('property_owner_contacts')
    .select('phone, owner_name').eq('property_id', propertyId)
    .not('phone', 'is', null).limit(1).maybeSingle()
  const aPhone: string = ownerRow?.phone ?? `prop:${propertyId}`

  // A's DEMANDA (A as buyer), if registered — needed for opt3 reciprocity.
  let aDemand: unknown = null
  if (ownerRow?.phone) {
    const { data: aClient } = await supabase.from('clients')
      .select('preference_embedding').eq('phone', ownerRow.phone)
      .not('preference_embedding', 'is', null).maybeSingle()
    aDemand = aClient?.preference_embedding ?? null
  }

  // opt1: parties B whose DEMANDA is satisfied by A's OFERTA (this property).
  const { data: matches } = await supabase.rpc('find_cross_agent_matches', {
    p_property_id: propertyId,
    p_embedding: prop.embedding,
    p_listing_agent_id: prop.listing_agent_id,
    p_threshold: THRESHOLD,
  })

  const out: InterlinkCandidate[] = []
  for (const m of (matches ?? [])) {
    const { data: bClient } = await supabase.from('clients')
      .select('id, phone, wa_contact_id').eq('id', m.client_id).maybeSingle()
    const bPhone: string = bClient?.phone ?? bClient?.wa_contact_id ?? `client:${m.client_id}`
    if (bPhone === aPhone) continue // same party is not an interlink

    // opt3: does B offer something matching A's DEMANDA? (reciprocal)
    let bOffer: string | null = null
    if (aDemand && bClient?.phone) {
      const { data: recip } = await supabase.rpc('find_offers_for_demand', {
        p_embedding: aDemand, p_owner_phone: bClient.phone, p_threshold: THRESHOLD,
      })
      bOffer = recip?.[0]?.property_id ?? null
    }
    const option: MatchOption = bOffer ? 'opt3' : 'opt1'

    // active when the counterparty is already being worked on this property.
    const { count } = await supabase.from('events')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', m.client_id).eq('property_id', propertyId)
    const active = (count ?? 0) > 0

    const sim = (m.similarity * 100).toFixed(0)
    const explanation = option === 'opt3'
      ? `Negocio entrelazado RECÍPROCO (opción 3): ${m.client_name} demanda lo que ofrece esta propiedad y a su vez ofrece algo que el dueño busca. Similitud: ${sim}%.`
      : `Negocio entrelazado (opción 1): la oferta de esta propiedad satisface la demanda de ${m.client_name}. Similitud: ${sim}%.`

    out.push({
      a_phone: aPhone, b_phone: bPhone, match_option: option,
      a_offer_property_id: propertyId, b_offer_property_id: bOffer,
      similarity: m.similarity, active, explanation,
    })
  }
  return out
}
