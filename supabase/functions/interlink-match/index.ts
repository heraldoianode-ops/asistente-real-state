// PropTech AI Platform — F121 Active interlinked-business matching (M2)
//
// ADDITIVE, FREE discovery layer: pgvector semantic match (find_cross_agent_matches,
// Ollama embeddings — zero Claude tokens) widens candidate buyers; on top of that
// we detect interlinked business — a candidate buyer who ALSO owns another agency
// property (matched by phone) is an ACTIVE interlink (a deal chain).
//
// "Analizar la coincidencia antes de validar": rows are stored as 'candidate';
// nothing is auto-validated. Secret-key protected (P008). No web access (D019).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'

const THRESHOLD = 0.72

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

    const { data: prop } = await supabase.from('properties')
      .select('id, listing_agent_id, neighborhood, price, embedding')
      .eq('id', property_id).maybeSingle()
    if (!prop) return json({ error: 'property not found' }, 404)
    if (!prop.embedding) return json({ candidates: [], note: 'property has no embedding yet' })

    // Additive pgvector layer (free): cross-agent candidate buyers.
    const { data: matches } = await supabase.rpc('find_cross_agent_matches', {
      p_property_id: property_id,
      p_embedding: prop.embedding,
      p_listing_agent_id: prop.listing_agent_id,
      p_threshold: THRESHOLD,
    })

    const candidates = []
    for (const m of (matches ?? [])) {
      // Resolve the candidate buyer's phone to detect an interlink.
      const { data: client } = await supabase.from('clients')
        .select('id, phone, wa_contact_id').eq('id', m.client_id).maybeSingle()
      const phone = client?.phone ?? client?.wa_contact_id
      if (!phone) continue

      // Interlink: is this buyer ALSO an owner of another agency property?
      const { data: ownerOf } = await supabase.from('property_owner_contacts')
        .select('property_id').eq('phone', phone).neq('property_id', property_id)
      for (const link of (ownerOf ?? [])) {
        const explanation =
          `Negocio entrelazado ACTIVO: ${m.client_name} (interesado en propiedad de ${prop.neighborhood ?? 'zona'}) ` +
          `también es dueño de otra propiedad de la agencia. Similitud comprador: ${(m.similarity * 100).toFixed(0)}%.`
        const { data: inserted } = await supabase.from('interlink_matches')
          .upsert({
            property_id,
            client_id: m.client_id,
            linked_property_id: link.property_id,
            link_type: 'active',
            similarity: m.similarity,
            explanation,
            status: 'candidate',
          }, { onConflict: 'property_id,client_id,linked_property_id' })
          .select('id').single()
        if (inserted) {
          candidates.push({
            interlink_id: inserted.id,
            client_id: m.client_id,
            client_name: m.client_name,
            linked_property_id: link.property_id,
            similarity: m.similarity,
            explanation,
          })
        }
      }
    }

    return json({ candidates, total: candidates.length })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
