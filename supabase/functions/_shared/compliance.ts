// PropTech AI Platform — non-compliance detection (M2/F120).
//
// Detects overdue/stalled items and raises NEW alarms (deduped against open ones
// so the martillero isn't re-alerted every run). Shared by the compliance-alarms
// endpoint and the scheduled `compliance_alarms` job. Deterministic, zero LLM.

export interface Alarm { kind: string; ref_type: string; ref_id: string; message: string }

const DAY = 24 * 3600 * 1000

// deno-lint-ignore no-explicit-any
export async function detectAlarms(supabase: any): Promise<Alarm[]> {
  const nowIso = new Date().toISOString()
  const dayAgo = new Date(Date.now() - DAY).toISOString()
  const candidates: Alarm[] = []

  // 1) Visits past their scheduled time, still 'scheduled' (no result logged).
  const { data: visits } = await supabase.from('events')
    .select('id, scheduled_at')
    .eq('event_type', 'visita').eq('status', 'scheduled')
    .lt('scheduled_at', nowIso).limit(500)
  for (const v of (visits ?? [])) {
    candidates.push({
      kind: 'visita_vencida', ref_type: 'event', ref_id: v.id,
      message: `Visita vencida sin registrar resultado (programada ${v.scheduled_at}).`,
    })
  }

  // 2) Visit requests awaiting advisor confirmation for >24h.
  const { data: pend } = await supabase.from('events')
    .select('id, created_at')
    .eq('event_type', 'visita').eq('status', 'pending_advisor')
    .lt('created_at', dayAgo).limit(500)
  for (const p of (pend ?? [])) {
    candidates.push({
      kind: 'confirmacion_pendiente', ref_type: 'event', ref_id: p.id,
      message: `Solicitud de visita sin confirmar hace más de 24 h.`,
    })
  }

  if (candidates.length === 0) return []

  // Dedup against currently-open alarms.
  const refIds = [...new Set(candidates.map((a) => a.ref_id))]
  const { data: open } = await supabase.from('compliance_alarms')
    .select('kind, ref_id').eq('status', 'open').in('ref_id', refIds)
  const seen = new Set((open ?? []).map((e: { kind: string; ref_id: string }) => `${e.kind}|${e.ref_id}`))
  const fresh = candidates.filter((a) => !seen.has(`${a.kind}|${a.ref_id}`))

  if (fresh.length) {
    await supabase.from('compliance_alarms').insert(
      fresh.map((a) => ({ kind: a.kind, ref_type: a.ref_type, ref_id: a.ref_id, message: a.message, status: 'open' })),
    )
  }
  return fresh
}
