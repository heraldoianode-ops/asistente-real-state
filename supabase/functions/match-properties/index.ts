import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SIMILARITY_THRESHOLD = 0.72

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } }
    )

    const { property_id } = await req.json()
    if (!property_id) {
      return new Response(JSON.stringify({ error: 'property_id required' }), { status: 400, headers: corsHeaders })
    }

    // Load the source property with its embedding
    const { data: prop, error: propErr } = await supabase
      .from('properties')
      .select('id, listing_agent_id, operation_type, property_type, neighborhood, bedrooms, price, embedding')
      .eq('id', property_id)
      .single()

    if (propErr || !prop) {
      return new Response(JSON.stringify({ error: 'Property not found' }), { status: 404, headers: corsHeaders })
    }

    if (!prop.embedding) {
      return new Response(JSON.stringify({ matches: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Find clients from OTHER agents that match via pgvector similarity
    const { data: matches } = await supabase.rpc('find_cross_agent_matches', {
      p_property_id: property_id,
      p_embedding: prop.embedding,
      p_listing_agent_id: prop.listing_agent_id,
      p_threshold: SIMILARITY_THRESHOLD,
    })

    const results = []
    for (const match of (matches ?? [])) {
      // Check dedup — avoid inserting same match twice
      const { data: existing } = await supabase
        .from('cross_agent_matches')
        .select('id')
        .eq('property_id', property_id)
        .eq('client_id', match.client_id)
        .maybeSingle()

      if (existing) continue

      const explanation = `Coincidencia detectada: la propiedad en ${prop.neighborhood ?? 'sin zona'} (${prop.bedrooms ?? '?'} amb, $${prop.price ?? '?'}) es compatible con los criterios del cliente ${match.client_name} del agente ${match.agent_name}. Similitud: ${(match.similarity * 100).toFixed(0)}%.`

      const { data: inserted } = await supabase
        .from('cross_agent_matches')
        .insert({
          property_id,
          client_id: match.client_id,
          listing_agent_id: prop.listing_agent_id,
          client_agent_id: match.agent_id,
          similarity_score: match.similarity,
          explanation,
          status: 'pending',
        })
        .select('id')
        .single()

      if (inserted) {
        results.push({ match_id: inserted.id, client_name: match.client_name, agent_name: match.agent_name })

        // Trigger WhatsApp notification (fire-and-forget)
        const gatewayUrl = Deno.env.get('WHATSAPP_GATEWAY_URL')
        if (gatewayUrl) {
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-agent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              match_id: inserted.id,
              listing_agent_id: prop.listing_agent_id,
              explanation,
            }),
          }).catch(() => null)
        }
      }
    }

    return new Response(
      JSON.stringify({ matches: results, total: results.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
