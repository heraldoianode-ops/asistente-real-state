// Google OAuth — start flow. Returns the Google consent URL for the authenticated agent.
// ES: Inicia la conexión de Google Calendar del agente logueado (genera state anti-CSRF).
// EN: Starts the logged-in agent's Google Calendar connection (generates anti-CSRF state).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401)

    const url = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      db: { schema: 'asistente_real_state' },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Invalid session' }, 401)

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'asistente_real_state' } })
    const { data: agent } = await admin.from('users').select('id').eq('auth_user_id', user.id).single()
    if (!agent) return json({ error: 'Agent not found' }, 403)

    const state = crypto.randomUUID()
    await admin.from('google_oauth_states').insert({ state, agent_id: agent.id })

    const params = new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
      redirect_uri: Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI')!,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    })
    return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
