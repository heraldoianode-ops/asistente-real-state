import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'asistente_real_state' } })
    const { match_id, listing_agent_id, explanation } = await req.json()
    const { data: waNumber } = await supabase.from('whatsapp_numbers').select('phone_number').eq('agent_id', listing_agent_id).eq('is_active', true).maybeSingle()
    if (!waNumber) return new Response(JSON.stringify({ ok: false, reason: 'No active WA number' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const gatewayUrl = Deno.env.get('WHATSAPP_GATEWAY_URL')
    if (!gatewayUrl) return new Response(JSON.stringify({ ok: false, reason: 'WHATSAPP_GATEWAY_URL not set' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const message = `🏠 *Nueva coincidencia*\n\n${explanation}\n\n_Ingresá al dashboard para ver los detalles._`
    // Service-to-service call: wa-gateway /send accepts the service-role key as a trusted internal caller.
    const res = await fetch(`${gatewayUrl}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` }, body: JSON.stringify({ to: waNumber.phone_number, message }) })
    return new Response(JSON.stringify({ ok: res.ok, match_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
