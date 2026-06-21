// PropTech AI Platform — F134 Deals-in-process report (M3)
//
// Surfaces operations advisors are actively trying to close — SOLO (one advisor)
// or EN EQUIPO (two advisors) — with the operation and its current state. Detected
// deterministically from active events, cross-agent matches and active interlinks
// (no LLM, free). Optional agent_id filters to that advisor's deals.
// Secret-key protected (P008).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'

type Deal = {
  source: 'visita' | 'equipo' | 'entrelazado'
  type: 'solo' | 'equipo' | 'entrelazado'
  operation: string
  advisor_ids: string[]
  advisors: string[]
  state: string
}

function visitaState(status: string, scheduledAt: string | null): string {
  if (status === 'pending_advisor') return 'Esperando confirmación de visita'
  if (status === 'completed') return 'Visita realizada'
  if (status === 'scheduled') {
    const future = scheduledAt && new Date(scheduledAt).getTime() > Date.now()
    return future ? 'Visita agendada' : 'Visita realizada, a confirmar resultado'
  }
  return status
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { agent_id } = await req.json().catch(() => ({}))
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    // Name lookups.
    const { data: users } = await supabase.from('users').select('id, full_name')
    const userName = new Map<string, string>((users ?? []).map((u: { id: string; full_name: string }) => [u.id, u.full_name]))
    const name = (id?: string | null) => (id ? userName.get(id) ?? 'asesor' : null)

    const deals: Deal[] = []

    // 1) Visits in progress → solo / equipo.
    const { data: events } = await supabase.from('events')
      .select('client_id, agent_id, property_id, status, scheduled_at')
      .eq('event_type', 'visita').in('status', ['pending_advisor', 'scheduled', 'completed']).limit(300)
    const cIds = [...new Set((events ?? []).map((e: { client_id: string }) => e.client_id))]
    const pIds = [...new Set((events ?? []).map((e: { property_id: string }) => e.property_id).filter(Boolean))]
    const { data: clients } = cIds.length
      ? await supabase.from('clients').select('id, full_name, assigned_agent_id').in('id', cIds) : { data: [] }
    const { data: props } = pIds.length
      ? await supabase.from('properties').select('id, title, address, listing_agent_id').in('id', pIds) : { data: [] }
    // deno-lint-ignore no-explicit-any
    const clientMap = new Map<string, any>((clients ?? []).map((c: any) => [c.id, c]))
    // deno-lint-ignore no-explicit-any
    const propMap = new Map<string, any>((props ?? []).map((p: any) => [p.id, p]))

    for (const ev of (events ?? [])) {
      const cl = clientMap.get(ev.client_id)
      const pr = ev.property_id ? propMap.get(ev.property_id) : null
      const clientAgent = cl?.assigned_agent_id ?? ev.agent_id
      const listingAgent = pr?.listing_agent_id ?? null
      const advisor_ids = [...new Set([clientAgent, listingAgent].filter(Boolean) as string[])]
      deals.push({
        source: 'visita',
        type: advisor_ids.length > 1 ? 'equipo' : 'solo',
        operation: `${cl?.full_name ?? 'cliente'} ↔ ${pr?.title ?? pr?.address ?? 'propiedad'}`,
        advisor_ids,
        advisors: advisor_ids.map((a) => name(a)!).filter(Boolean),
        state: visitaState(ev.status, ev.scheduled_at),
      })
    }

    // 2) Cross-agent matches in progress → equipo.
    const { data: cam } = await supabase.from('cross_agent_matches')
      .select('property_id, listing_agent_id, buyer_agent_id, buyer_client_name, status')
      .in('status', ['pending', 'contacted']).limit(300)
    const camPropIds = [...new Set((cam ?? []).map((m: { property_id: string }) => m.property_id))]
    const { data: camProps } = camPropIds.length
      ? await supabase.from('properties').select('id, title, address').in('id', camPropIds) : { data: [] }
    // deno-lint-ignore no-explicit-any
    const camPropMap = new Map<string, any>((camProps ?? []).map((p: any) => [p.id, p]))
    for (const m of (cam ?? [])) {
      const pr = camPropMap.get(m.property_id)
      const advisor_ids = [...new Set([m.listing_agent_id, m.buyer_agent_id].filter(Boolean) as string[])]
      deals.push({
        source: 'equipo',
        type: 'equipo',
        operation: `${m.buyer_client_name ?? 'comprador'} ↔ ${pr?.title ?? pr?.address ?? 'propiedad'}`,
        advisor_ids,
        advisors: advisor_ids.map((a) => name(a)!).filter(Boolean),
        state: m.status === 'contacted' ? 'En contacto (equipo de asesores)' : 'Match entre asesores pendiente de coordinar',
      })
    }

    // 3) Active interlinks → entrelazado.
    const { data: il } = await supabase.from('interlink_matches')
      .select('explanation, status').eq('link_type', 'active').in('status', ['candidate', 'validated']).limit(200)
    for (const x of (il ?? [])) {
      deals.push({
        source: 'entrelazado',
        type: 'entrelazado',
        operation: (x.explanation ?? 'negocio entrelazado').slice(0, 160),
        advisor_ids: [],
        advisors: [],
        state: x.status === 'validated' ? 'Entrelazado validado, en cierre' : 'Entrelazado en análisis',
      })
    }

    const filtered = agent_id ? deals.filter((d) => d.advisor_ids.includes(agent_id)) : deals
    const by_type = {
      solo: filtered.filter((d) => d.type === 'solo').length,
      equipo: filtered.filter((d) => d.type === 'equipo').length,
      entrelazado: filtered.filter((d) => d.type === 'entrelazado').length,
    }

    return json({ deals: filtered, total: filtered.length, by_type })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
