// PropTech AI Platform — central calendar + weekly schedule (M3/F133).
//
// Builds the agenda from the events table and the automated weekly report,
// delivered to each advisor via the WhatsApp gateway /send endpoint. Free, no LLM.

export interface AgendaEntry {
  agent_id: string | null
  scheduled_at: string
  event_type: string
  status: string
  client_name: string
  property_label: string
}

const FMT = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})
export const formatDt = (iso: string) => FMT.format(new Date(iso))

// deno-lint-ignore no-explicit-any
export async function weeklySchedule(supabase: any, fromIso: string, toIso: string): Promise<AgendaEntry[]> {
  const { data: events } = await supabase.from('events')
    .select('agent_id, client_id, property_id, event_type, status, scheduled_at')
    .gte('scheduled_at', fromIso).lte('scheduled_at', toIso)
    .in('status', ['scheduled', 'pending_advisor'])
    .order('scheduled_at', { ascending: true }).limit(500)

  const cIds = [...new Set((events ?? []).map((e: { client_id: string }) => e.client_id).filter(Boolean))]
  const pIds = [...new Set((events ?? []).map((e: { property_id: string }) => e.property_id).filter(Boolean))]
  const { data: clients } = cIds.length
    ? await supabase.from('clients').select('id, full_name').in('id', cIds) : { data: [] }
  const { data: props } = pIds.length
    ? await supabase.from('properties').select('id, title, address, listing_agent_id').in('id', pIds) : { data: [] }
  const cName = new Map<string, string>((clients ?? []).map((c: { id: string; full_name: string }) => [c.id, c.full_name]))
  // deno-lint-ignore no-explicit-any
  const pMap = new Map<string, any>((props ?? []).map((p: any) => [p.id, p]))

  return (events ?? []).map((e: { agent_id: string | null; client_id: string; property_id: string | null; event_type: string; status: string; scheduled_at: string }) => {
    const pr = e.property_id ? pMap.get(e.property_id) : null
    return {
      agent_id: e.agent_id ?? pr?.listing_agent_id ?? null,
      scheduled_at: e.scheduled_at,
      event_type: e.event_type,
      status: e.status,
      client_name: cName.get(e.client_id) ?? 'cliente',
      property_label: pr?.title ?? pr?.address ?? 'propiedad',
    }
  })
}

async function sendViaGateway(to: string, message: string): Promise<boolean> {
  const gw = Deno.env.get('WHATSAPP_GATEWAY_URL')
  if (!gw || !to) return false
  try {
    const r = await fetch(`${gw}/send`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to, message }),
    })
    return r.ok
  } catch {
    return false
  }
}

// deno-lint-ignore no-explicit-any
export async function runWeeklyReport(supabase: any): Promise<{ sent: number; messages: unknown[] }> {
  const from = new Date().toISOString()
  const to = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  const entries = await weeklySchedule(supabase, from, to)

  const byAgent = new Map<string, AgendaEntry[]>()
  for (const e of entries) {
    if (!e.agent_id) continue
    const arr = byAgent.get(e.agent_id) ?? []
    arr.push(e); byAgent.set(e.agent_id, arr)
  }

  const agentIds = [...byAgent.keys()]
  const { data: nums } = agentIds.length
    ? await supabase.from('whatsapp_numbers').select('agent_id, phone_number').eq('is_active', true).in('agent_id', agentIds)
    : { data: [] }
  const phone = new Map<string, string>((nums ?? []).map((n: { agent_id: string; phone_number: string }) => [n.agent_id, n.phone_number]))

  let sent = 0
  const messages = []
  for (const [agentId, list] of byAgent) {
    const lines = list.map((e) => `• ${formatDt(e.scheduled_at)} ${e.event_type}: ${e.client_name} ↔ ${e.property_label}`)
    const message = `📅 Tu agenda de la semana (${list.length}):\n${lines.join('\n')}`
    const to = phone.get(agentId) ?? null
    const ok = to ? await sendViaGateway(to, message) : false
    if (ok) sent++
    messages.push({ agent_id: agentId, to, count: list.length, sent: ok, message })
  }
  return { sent, messages }
}
