import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'asistente_real_state' } })
    const { property_id } = await req.json()
    if (!property_id) return new Response(JSON.stringify({ error: 'property_id required' }), { status: 400, headers: corsHeaders })
    const { data: prop } = await supabase.from('properties').select('id,listing_agent_id,neighborhood,bedrooms,price,embedding').eq('id', property_id).single()
    if (!prop?.embedding) return new Response(JSON.stringify({ matches: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: matches } = await supabase.rpc('find_cross_agent_matches_v2', {
      p_property_id: property_id,
      p_embedding: prop.embedding,
      p_listing_agent_id: prop.listing_agent_id,
      p_threshold: 0.65,
    })

    const results = []
    for (const match of (matches ?? [])) {
      const { data: existing } = await supabase.from('cross_agent_matches').select('id').eq('property_id', property_id).eq('buyer_client_id', match.client_id).maybeSingle()
      if (existing) continue

      const contextTag = match.has_conversation_context ? ' (con contexto conversacional)' : ''
      const explanation = `Coincidencia${contextTag}: propiedad en ${prop.neighborhood ?? 'zona'} (${prop.bedrooms ?? '?'} amb, $${prop.price ?? '?'}) compatible con cliente ${match.client_name} del agente ${match.agent_name}. Similitud: ${(match.similarity * 100).toFixed(0)}%.`

      const { data: inserted } = await supabase.from('cross_agent_matches').insert({
        property_id,
        buyer_client_id: match.client_id,
        listing_agent_id: prop.listing_agent_id,
        buyer_agent_id: match.agent_id,
        match_score: match.similarity,
        match_explanation: explanation,
        buyer_client_name: match.client_name,
        status: 'pending',
      }).select('id').single()

      if (inserted) {
        results.push({ match_id: inserted.id, client_name: match.client_name, agent_name: match.agent_name, has_conversation_context: match.has_conversation_context })
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
          body: JSON.stringify({ match_id: inserted.id, listing_agent_id: prop.listing_agent_id, explanation }),
        }).catch(() => null)
      }
    }
    return new Response(JSON.stringify({ matches: results, total: results.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
