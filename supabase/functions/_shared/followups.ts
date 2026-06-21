// PropTech AI Platform — end-of-day deal follow-ups (M3/F136, D025).
//
// The bot nudges advisors to advance stuck operations toward closing:
//   post-visit  -> "¿cómo fue la visita? ¿sigue o se descarta?"
//   reservation -> "¿confirmás la reserva?" / (venta) "¿fue aceptada?"
// Advisor replies route back to the operations endpoint actions. Throttled via
// followup_sent_at. Sent via the gateway /send. Free, no LLM.
import { sendViaGateway } from './notify.ts'

const STALE = () => new Date(Date.now() - 20 * 3600 * 1000).toISOString()

// deno-lint-ignore no-explicit-any
async function resolve(supabase: any, ops: any[]) {
  const agentIds = [...new Set(ops.map((o) => o.agent_id).filter(Boolean))]
  const clientIds = [...new Set(ops.map((o) => o.client_id).filter(Boolean))]
  const propIds = [...new Set(ops.map((o) => o.property_id).filter(Boolean))]
  const { data: nums } = agentIds.length
    ? await supabase.from('whatsapp_numbers').select('agent_id, phone_number').eq('is_active', true).in('agent_id', agentIds) : { data: [] }
  const { data: clients } = clientIds.length
    ? await supabase.from('clients').select('id, full_name').in('id', clientIds) : { data: [] }
  const { data: props } = propIds.length
    ? await supabase.from('properties').select('id, title, address').in('id', propIds) : { data: [] }
  return {
    phone: new Map<string, string>((nums ?? []).map((n: { agent_id: string; phone_number: string }) => [n.agent_id, n.phone_number])),
    cName: new Map<string, string>((clients ?? []).map((c: { id: string; full_name: string }) => [c.id, c.full_name])),
    // deno-lint-ignore no-explicit-any
    pLabel: new Map<string, string>((props ?? []).map((p: any) => [p.id, p.title ?? p.address ?? 'propiedad'])),
  }
}

// deno-lint-ignore no-explicit-any
export async function runPostVisitFollowup(supabase: any): Promise<{ asked: number }> {
  const { data: ops } = await supabase.from('operations')
    .select('id, agent_id, client_id, property_id')
    .in('stage', ['visita', 'post_visita'])
    .or(`followup_sent_at.is.null,followup_sent_at.lt.${STALE()}`).limit(200)
  if (!ops?.length) return { asked: 0 }
  const { phone, cName, pLabel } = await resolve(supabase, ops)
  let asked = 0
  for (const o of ops) {
    const msg = `¿Cómo fue la visita a ${pLabel.get(o.property_id) ?? 'la propiedad'} con ${cName.get(o.client_id) ?? 'el cliente'}? ¿Sigue interesado o se descarta?`
    if (await sendViaGateway(phone.get(o.agent_id) ?? null, msg)) asked++
    await supabase.from('operations').update({ followup_sent_at: new Date().toISOString() }).eq('id', o.id)
  }
  return { asked }
}

// deno-lint-ignore no-explicit-any
export async function runReservationFollowup(supabase: any): Promise<{ asked: number }> {
  const { data: ops } = await supabase.from('operations')
    .select('id, agent_id, client_id, property_id, operation_type, stage')
    .in('stage', ['reunion_reserva', 'reserva_confirmada'])
    .or(`followup_sent_at.is.null,followup_sent_at.lt.${STALE()}`).limit(200)
  if (!ops?.length) return { asked: 0 }
  const { phone, cName, pLabel } = await resolve(supabase, ops)
  let asked = 0
  for (const o of ops) {
    let msg: string | null = null
    if (o.stage === 'reunion_reserva') {
      msg = `¿El cliente ${cName.get(o.client_id) ?? ''} confirmó la reserva de ${pLabel.get(o.property_id) ?? 'la propiedad'}? (sí/no)`
    } else if (o.stage === 'reserva_confirmada' && /venta/i.test(o.operation_type ?? '')) {
      msg = `¿Fue aceptada la reserva de ${pLabel.get(o.property_id) ?? 'la propiedad'}? (sí/no)`
    }
    if (!msg) continue
    if (await sendViaGateway(phone.get(o.agent_id) ?? null, msg)) asked++
    await supabase.from('operations').update({ followup_sent_at: new Date().toISOString() }).eq('id', o.id)
  }
  return { asked }
}
