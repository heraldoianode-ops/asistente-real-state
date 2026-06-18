// Google OAuth — callback. Exchanges the auth code for tokens and stores the agent's
// refresh_token, then redirects back to the dashboard.
// ES: Canjea el código por tokens, guarda el refresh_token del agente y vuelve al panel.
// EN: Exchanges the code for tokens, stores the agent's refresh_token, returns to dashboard.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to } })

Deno.serve(async (req) => {
  const dashboard = Deno.env.get('DASHBOARD_URL') ?? 'https://solernou.netlify.app'
  const back = (s: string) => redirect(`${dashboard}/analytics?calendar=${s}`)
  try {
    const reqUrl = new URL(req.url)
    const code = reqUrl.searchParams.get('code')
    const state = reqUrl.searchParams.get('state')
    if (!code || !state) return back('error')

    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'asistente_real_state' } })

    const { data: st } = await admin.from('google_oauth_states').select('agent_id').eq('state', state).maybeSingle()
    if (!st) return back('error')
    await admin.from('google_oauth_states').delete().eq('state', state)

    const body = new URLSearchParams({
      code,
      client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
      redirect_uri: Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI')!,
      grant_type: 'authorization_code',
    })
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const tok = await tokenRes.json()
    if (!tok.refresh_token) return back('error')

    let email: string | null = null
    try {
      const ui = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } })
      email = (await ui.json())?.email ?? null
    } catch { /* email is optional */ }

    const expiry = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString()
    await admin.from('agent_google_credentials').upsert({
      agent_id: st.agent_id,
      refresh_token: tok.refresh_token,
      access_token: tok.access_token ?? null,
      token_expiry: expiry,
      google_email: email,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_id' })

    return back('connected')
  } catch {
    return back('error')
  }
})
