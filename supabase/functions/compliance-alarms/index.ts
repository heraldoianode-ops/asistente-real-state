// PropTech AI Platform — F120 non-compliance alarms → martillero (M2)
//
// Runs the shared detector and returns the newly raised alarms plus a notify
// payload for the martillero (wa_martillera) to be sent by the gateway. Can be
// invoked on demand or by the scheduled `compliance_alarms` job (F101).
// Secret-key protected (P008). Deterministic, zero LLM.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { detectAlarms } from '../_shared/compliance.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    const raised = await detectAlarms(supabase)

    let notify = null
    if (raised.length) {
      const martillera = (await supabase.from('app_settings')
        .select('value').eq('key', 'wa_martillera').maybeSingle()).data?.value ?? null
      notify = {
        martillera,
        message: `⚠️ ${raised.length} alarma(s) de incumplimiento:\n` +
          raised.map((a) => `• ${a.message}`).join('\n'),
      }
    }

    return json({ raised, total: raised.length, notify })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
