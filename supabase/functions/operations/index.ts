// PropTech AI Platform — F136 Deal lifecycle / operations (M3, D025)
//
// Tracks an operation (client↔property) to closing. Closing rules:
//   VENTA     => reserva confirmada Y aceptada  (reserva_aceptada)
//   ALQUILER  => reserva confirmada             (reserva_confirmada)
//
// Actions (driven by the bot/advisor as the conversation progresses):
//   after_visit         -> ask the advisor how the visit went (post_visita)
//   visit_result        -> sigue | descartado (descartado => lost)
//   reservation_meeting -> client reached a reservation meeting
//   confirm_reservation -> end-of-day reservation confirmation
//   confirm_acceptance  -> (venta) owner accepted the reservation
//   list                -> list operations by status/agent
// Secret-key protected (P008). Deterministic, zero LLM.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'

const now = () => new Date().toISOString()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const body = await req.json()
    const action = body.action
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )
    // deno-lint-ignore no-explicit-any
    const update = (id: string, patch: any) =>
      supabase.from('operations').update({ ...patch, updated_at: now() }).eq('id', id).select('*').single()
    const load = async (id: string) =>
      (await supabase.from('operations').select('*').eq('id', id).maybeSingle()).data

    if (action === 'list') {
      let q = supabase.from('operations').select('id, client_id, property_id, agent_id, operation_type, stage, status, closed_at')
      if (body.status) q = q.eq('status', body.status)
      if (body.stage) q = q.eq('stage', body.stage)
      if (body.agent_id) q = q.eq('agent_id', body.agent_id)
      const { data } = await q.order('updated_at', { ascending: false }).limit(500)
      return json({ operations: data ?? [] })
    }

    if (action === 'after_visit') {
      const { client_id, property_id } = body
      if (!client_id || !property_id) return json({ error: 'client_id and property_id required' }, 400)
      const { data: prop } = await supabase.from('properties')
        .select('operation_type, listing_agent_id, title, address').eq('id', property_id).maybeSingle()
      const { data: cl } = await supabase.from('clients').select('full_name, assigned_agent_id').eq('id', client_id).maybeSingle()
      const agent_id = cl?.assigned_agent_id ?? prop?.listing_agent_id ?? null
      const { data: op } = await supabase.from('operations').upsert({
        client_id, property_id, agent_id, operation_type: prop?.operation_type ?? null,
        stage: 'post_visita', updated_at: now(),
      }, { onConflict: 'client_id,property_id' }).select('id').single()
      const label = prop?.title ?? prop?.address ?? 'la propiedad'
      return json({
        operation_id: op?.id,
        ask: { to: 'asesor', advisor_id: agent_id, message: `¿Cómo fue la visita a ${label} con ${cl?.full_name ?? 'el cliente'}? ¿Sigue interesado o se descarta?` },
      })
    }

    // From here, an operation_id is required.
    if (!body.operation_id) return json({ error: 'operation_id required' }, 400)
    const op = await load(body.operation_id)
    if (!op) return json({ error: 'operation not found' }, 404)

    if (action === 'visit_result') {
      if (body.result === 'descartado') {
        const { data } = await update(op.id, { stage: 'descartado', status: 'lost', closed_at: now() })
        return json({ operation: data, closed: true, status: 'lost' })
      }
      const { data } = await update(op.id, { stage: 'sigue' })
      return json({ operation: data, closed: false })
    }

    if (action === 'reservation_meeting') {
      const { data } = await update(op.id, { stage: 'reunion_reserva' })
      return json({ operation: data })
    }

    if (action === 'confirm_reservation') {
      if (!body.confirmed) {
        const { data } = await update(op.id, { stage: 'sigue' })
        return json({ operation: data, closed: false, note: 'No se concretó la reserva; sigue en pie.' })
      }
      const isAlquiler = /alqui/i.test(op.operation_type ?? '')
      if (isAlquiler) {
        const { data } = await update(op.id, { stage: 'reserva_confirmada', status: 'won', reserved_at: now(), closed_at: now() })
        return json({ operation: data, closed: true, status: 'won', note: 'Alquiler cerrado (reserva suficiente).' })
      }
      const { data } = await update(op.id, { stage: 'reserva_confirmada', reserved_at: now() })
      return json({ operation: data, closed: false, next: 'confirm_acceptance', note: 'Venta: falta confirmar aceptación de la reserva.' })
    }

    if (action === 'confirm_acceptance') {
      if (body.accepted) {
        const { data } = await update(op.id, { stage: 'reserva_aceptada', status: 'won', accepted_at: now(), closed_at: now() })
        return json({ operation: data, closed: true, status: 'won', note: 'Venta cerrada (reserva aceptada).' })
      }
      const { data } = await update(op.id, { stage: 'caido', status: 'lost', closed_at: now() })
      return json({ operation: data, closed: false, status: 'lost', note: 'Reserva no aceptada.' })
    }

    return json({ error: 'unknown action' }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
