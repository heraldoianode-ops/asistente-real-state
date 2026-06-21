// PropTech AI Platform — F123 Capture documentation management (M2, corrected flow)
//
// Escalation (the bot asks the ADVISOR first, never the owner directly):
//   asesor          -> remind the listing advisor (up to 3 attempts)
//   await_martillero -> after 3 failed asks, notify the martillero and ask whether
//                       the bot should request it directly
//   bot             -> martillero authorized -> bot requests it (from the owner)
//   measures        -> still not received -> notify martillero to take measures
//   done            -> received / handled
//
// Actions: request (drive the state machine) | authorize (martillero accept/decline)
//          | receive (doc arrived → validate) | validate (martillero verdict) | status.
// Deterministic, zero LLM. The gateway performs the WhatsApp sends. Secret-key (P008).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'

const ATTEMPT_LIMIT = 3
const DEFAULT_DOCS = [
  'escritura', 'plano', 'reglamento_copropiedad',
  'libre_deuda_expensas', 'impuesto_inmobiliario', 'dni_titular',
]
const now = () => new Date().toISOString()

// deno-lint-ignore no-explicit-any
async function requiredDocs(supabase: any): Promise<string[]> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'required_capture_docs').maybeSingle()
  const v = data?.value as string | null
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_DOCS
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { action, property_id, doc_type, file_url, decision, validated_by } = await req.json()
    if (!property_id) return json({ error: 'property_id required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    const { data: prop } = await supabase.from('properties')
      .select('id, title, address, listing_agent_id').eq('id', property_id).maybeSingle()
    if (!prop) return json({ error: 'property not found' }, 404)
    const propLabel = prop.title ?? prop.address ?? property_id
    const martillera = async () => (await supabase.from('app_settings')
      .select('value').eq('key', 'wa_martillera').maybeSingle()).data?.value ?? null
    const ownerPhone = async () => (await supabase.from('property_owner_contacts')
      .select('phone').eq('property_id', property_id).not('phone', 'is', null).limit(1).maybeSingle()).data?.phone ?? null

    // --- status ---------------------------------------------------------------
    if (action === 'status') {
      const { data: docs } = await supabase.from('capture_documents')
        .select('doc_type, status, escalation_stage, attempts, file_url').eq('property_id', property_id)
      return json({ property_id, docs: docs ?? [] })
    }

    // --- receive (doc arrived → forward to martillero to validate) -----------
    if (action === 'receive') {
      if (!doc_type) return json({ error: 'doc_type required' }, 400)
      await supabase.from('capture_documents').upsert({
        property_id, doc_type, status: 'received', escalation_stage: 'done',
        file_url: file_url ?? null, received_at: now(),
      }, { onConflict: 'property_id,doc_type' })
      return json({
        property_id, doc_type, status: 'received',
        notify: { to: 'martillero', martillera: await martillera(), message: `Documento recibido para validar: ${doc_type} (${propLabel}).` },
      })
    }

    // --- validate -------------------------------------------------------------
    if (action === 'validate') {
      if (!doc_type || (decision !== 'validate' && decision !== 'reject')) {
        return json({ error: "doc_type and decision ('validate'|'reject') required" }, 400)
      }
      await supabase.from('capture_documents').update({
        status: decision === 'validate' ? 'validated' : 'rejected',
        validated_at: now(), validated_by: validated_by ?? null,
      }).eq('property_id', property_id).eq('doc_type', doc_type)
      return json({ property_id, doc_type, status: decision === 'validate' ? 'validated' : 'rejected' })
    }

    // --- authorize (martillero decides whether the bot may request directly) --
    if (action === 'authorize') {
      if (decision !== 'accept' && decision !== 'decline') {
        return json({ error: "decision ('accept'|'decline') required" }, 400)
      }
      let q = supabase.from('capture_documents').select('doc_type')
        .eq('property_id', property_id).eq('escalation_stage', 'await_martillero')
      if (doc_type) q = q.eq('doc_type', doc_type)
      const { data: pending } = await q
      const types = (pending ?? []).map((d: { doc_type: string }) => d.doc_type)
      if (types.length === 0) return json({ property_id, note: 'no hay documentos esperando autorización' })

      if (decision === 'decline') {
        await supabase.from('capture_documents').update({ escalation_stage: 'done' })
          .eq('property_id', property_id).in('doc_type', types)
        return json({ property_id, decision, doc_types: types, note: 'El martillero gestionará la documentación.' })
      }

      // accept → bot requests the owner directly.
      await supabase.from('capture_documents').update({
        escalation_stage: 'bot', martillero_authorized: true, attempts: 1,
        status: 'requested', requested_at: now(),
      }).eq('property_id', property_id).in('doc_type', types)
      return json({
        property_id, decision, doc_types: types,
        notify: { to: 'owner', owner_phone: await ownerPhone(), message: `Necesitamos: ${types.join(', ')} de ${propLabel}. ¿Podés enviarlos por aquí?` },
      })
    }

    // --- request (default): drive the escalation state machine ----------------
    const docs = await requiredDocs(supabase)
    const { data: existing } = await supabase.from('capture_documents')
      .select('doc_type, status, escalation_stage, attempts').eq('property_id', property_id)
    const byType = new Map<string, { status: string; escalation_stage: string; attempts: number }>(
      (existing ?? []).map((d: { doc_type: string; status: string; escalation_stage: string; attempts: number }) => [d.doc_type, d]))

    const toInsert = docs.filter((t) => !byType.has(t))
      .map((t) => ({ property_id, doc_type: t, status: 'required', escalation_stage: 'asesor', attempts: 0 }))
    if (toInsert.length) {
      await supabase.from('capture_documents').insert(toInsert)
      for (const t of toInsert) byType.set(t.doc_type, { status: 'required', escalation_stage: 'asesor', attempts: 0 })
    }

    const notifications = []
    const waMartillera = await martillera()
    for (const t of docs) {
      const d = byType.get(t)!
      if (['received', 'validated'].includes(d.status) || d.escalation_stage === 'done') continue
      let attempts = d.attempts ?? 0

      if (d.escalation_stage === 'asesor') {
        attempts += 1
        if (attempts < ATTEMPT_LIMIT) {
          await supabase.from('capture_documents').update({ status: 'requested', attempts, requested_at: now() })
            .eq('property_id', property_id).eq('doc_type', t)
          notifications.push({ to: 'asesor', advisor_id: prop.listing_agent_id, doc_type: t,
            message: `Recordatorio (${attempts}/${ATTEMPT_LIMIT}): falta cargar "${t}" de ${propLabel}.` })
        } else {
          await supabase.from('capture_documents').update({ escalation_stage: 'await_martillero', attempts })
            .eq('property_id', property_id).eq('doc_type', t)
          notifications.push({ to: 'martillero', martillera: waMartillera, doc_type: t, requires_decision: true,
            message: `El asesor no entregó "${t}" de ${propLabel} tras ${ATTEMPT_LIMIT} pedidos. ¿Querés que el bot la solicite directamente? (autorizar/declinar)` })
        }
      } else if (d.escalation_stage === 'await_martillero') {
        notifications.push({ to: 'martillero', martillera: waMartillera, doc_type: t, requires_decision: true,
          message: `Sigue pendiente tu decisión sobre "${t}" de ${propLabel}.` })
      } else if (d.escalation_stage === 'bot') {
        // already requested from the owner on authorize; a new cycle still missing → measures.
        await supabase.from('capture_documents').update({ escalation_stage: 'measures' })
          .eq('property_id', property_id).eq('doc_type', t)
        notifications.push({ to: 'martillero', martillera: waMartillera, doc_type: t,
          message: `No se recibió "${t}" de ${propLabel} pese a solicitarla directamente. Tomar medidas.` })
      } else if (d.escalation_stage === 'measures') {
        notifications.push({ to: 'martillero', martillera: waMartillera, doc_type: t,
          message: `Pendiente de medidas: "${t}" de ${propLabel}.` })
      }
    }

    return json({ property_id, notifications, total: notifications.length })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
