// PropTech AI Platform — F133 Central calendar + weekly schedule report (M3)
//
//   agenda        (default) — central calendar for a date range, optional agent_id
//   weekly_report           — compile next 7 days per advisor + send via gateway
// Free, no LLM. Secret-key protected (P008). The weekly_report is also driven by
// the scheduler's weekly_calendar_report job (F101).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { weeklySchedule, runWeeklyReport, formatDt } from '../_shared/calendar.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { action, from, to, agent_id } = await req.json().catch(() => ({}))
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    if (action === 'weekly_report') {
      const result = await runWeeklyReport(supabase)
      return json(result)
    }

    // default: agenda for a range (defaults to next 7 days).
    const fromIso = from ?? new Date().toISOString()
    const toIso = to ?? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    let entries = await weeklySchedule(supabase, fromIso, toIso)
    if (agent_id) entries = entries.filter((e) => e.agent_id === agent_id)

    const agenda = entries.map((e) => ({
      when: formatDt(e.scheduled_at),
      scheduled_at: e.scheduled_at,
      event_type: e.event_type,
      status: e.status,
      agent_id: e.agent_id,
      operation: `${e.client_name} ↔ ${e.property_label}`,
    }))
    return json({ from: fromIso, to: toIso, total: agenda.length, agenda })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
