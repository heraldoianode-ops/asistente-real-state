import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'asistente_real_state' } })
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    const { data: { user: caller } } = await supabase.auth.getUser(token)
    if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    const { data: profile } = await supabase.from('users').select('role').eq('auth_user_id', caller.id).single()
    if (profile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    const { email, password, full_name, wa_contact_id } = await req.json()
    if (!email || !password) return new Response(JSON.stringify({ error: 'email and password required' }), { status: 400, headers: corsHeaders })
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
    if (authErr) throw authErr
    // id must equal the Supabase Auth uid so RLS agent-scoping (`<fk> = auth.uid()`) matches (TD-007)
    const { error: insertErr } = await supabase.from('users').insert({ id: authUser.user.id, auth_user_id: authUser.user.id, email, full_name: full_name || null, wa_contact_id: wa_contact_id || null, role: 'agent', is_active: true })
    if (insertErr) throw insertErr
    return new Response(JSON.stringify({ ok: true, id: authUser.user.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
