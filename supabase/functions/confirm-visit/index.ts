// PropTech AI Platform — F112 advisor visit confirmation (M1)
//
// The ONLY place a visit transitions from 'pending_advisor' to booked
// ('scheduled') — enforcing explicit advisor confirmation (pattern P009).
// Called by the advisor (dashboard/gateway) with the internal secret (P008).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { event_id, decision, scheduled_at, agent_id } = await req.json()
    if (!event_id || (decision !== 'confirm' && decision !== 'reject')) {
      return json({ error: "event_id and decision ('confirm'|'reject') required" }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    const { data: ev } = await supabase.from('events')
      .select('id, status, scheduled_at').eq('id', event_id).maybeSingle()
    if (!ev) return json({ error: 'event not found' }, 404)
    if (ev.status !== 'pending_advisor') {
      return json({ error: `event is '${ev.status}', not pending_advisor` }, 409)
    }

    if (decision === 'reject') {
      await supabase.from('events')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', event_id)
      return json({ status: 'rejected', event_id })
    }

    // confirm → book it
    const patch: Record<string, unknown> = { status: 'scheduled', updated_at: new Date().toISOString() }
    if (scheduled_at) patch.scheduled_at = scheduled_at
    if (agent_id) patch.agent_id = agent_id
    await supabase.from('events').update(patch).eq('id', event_id)

    return json({ status: 'scheduled', event_id, scheduled_at: scheduled_at ?? ev.scheduled_at })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
