// PropTech AI Platform — F101 Secret-key Scheduler (M0 Platform Core)
//
// Single entrypoint for scheduled jobs fired by GitHub Actions or Cron-Job.org
// (decision D018). The external scheduler POSTs { "job": "<name>" } with the
// x-internal-key secret header; this function dispatches to the matching job.
// No self-hosted workers, no Celery (superseded by D014/D018).
//
// Job implementations land with their owning modules:
//   - weekly_calendar_report  -> M3/F133
//   - owner_period_reports     -> M3/F130
//   - compliance_alarms        -> M2/F120
// Until then they are no-op stubs that report "pending" so the schedule and
// auth path can be wired and tested end-to-end now.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { detectAlarms } from '../_shared/compliance.ts'

type JobResult = { job: string; status: 'ok' | 'pending'; detail?: string }
type Job = (supabase: ReturnType<typeof createClient>) => Promise<JobResult>

const JOBS: Record<string, Job> = {
  // M3/F133 — weekly visit schedule broadcast to the whole team via WhatsApp.
  weekly_calendar_report: async () => ({
    job: 'weekly_calendar_report',
    status: 'pending',
    detail: 'Awaiting M3/F133 implementation.',
  }),
  // M3/F130 — programmable-period owner reports.
  owner_period_reports: async () => ({
    job: 'owner_period_reports',
    status: 'pending',
    detail: 'Awaiting M3/F130 implementation.',
  }),
  // M2/F120 — non-compliance alarms to the martillero.
  compliance_alarms: async (supabase) => {
    const raised = await detectAlarms(supabase)
    return { job: 'compliance_alarms', status: 'ok', detail: `${raised.length} alarma(s) nueva(s).` }
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { job } = await req.json() as { job?: string }
    if (!job) return json({ error: 'job required', available: Object.keys(JOBS) }, 400)
    const run = JOBS[job]
    if (!run) return json({ error: `unknown job: ${job}`, available: Object.keys(JOBS) }, 404)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )
    const result = await run(supabase)
    return json(result)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
