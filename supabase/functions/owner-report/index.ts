// PropTech AI Platform — F111 Ventas/Dueños: on-demand property status report (M1)
//
// An owner asks "¿cómo va mi propiedad?" — this builds a status report from real
// data (days on market, visits by status, cross-agent matches) and summarizes it
// owner-facing on the FREE tier (Ollama via router — zero Claude tokens, P006).
// On-demand only. Owner identified by their own contact phone. Secret-key (P008).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { runLLM } from '../_shared/llm-router.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { contact_phone, property_id } = await req.json()
    if (!contact_phone) return json({ error: 'contact_phone required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    // Owner's properties (the owner is the contact — returning their own data).
    let q = supabase.from('property_owner_contacts').select('property_id').eq('phone', contact_phone)
    if (property_id) q = q.eq('property_id', property_id)
    const { data: owned } = await q
    const ids = (owned ?? []).map((r: { property_id: string }) => r.property_id)
    if (ids.length === 0) {
      return json({ reports: [], reply: 'No encontré una propiedad asociada a este número. Verificá con tu asesor que tu contacto esté cargado.' })
    }

    const reports = []
    for (const pid of ids.slice(0, 3)) {
      const metrics = await gatherMetrics(supabase, pid)
      if (!metrics) continue
      const reply = await summarize(metrics)
      reports.push({ property_id: pid, metrics, reply })
    }

    return json({ reports })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function gatherMetrics(supabase: any, propertyId: string) {
  const { data: p } = await supabase.from('properties')
    .select('title, address, neighborhood, status, price, currency, operation_type, created_at')
    .eq('id', propertyId).maybeSingle()
  if (!p) return null

  const { data: visits } = await supabase.from('events')
    .select('status').eq('property_id', propertyId).eq('event_type', 'visita')
  const byStatus: Record<string, number> = {}
  for (const v of (visits ?? [])) byStatus[v.status] = (byStatus[v.status] ?? 0) + 1

  const { count: matches } = await supabase.from('cross_agent_matches')
    .select('id', { count: 'exact', head: true }).eq('property_id', propertyId)

  const days = Math.max(0, Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000))

  return {
    title: p.title ?? p.address,
    neighborhood: p.neighborhood,
    status: p.status,
    price: p.price,
    currency: p.currency,
    operation_type: p.operation_type,
    days_on_market: days,
    visits_total: (visits ?? []).length,
    visits_scheduled: byStatus['scheduled'] ?? 0,
    visits_pending: byStatus['pending_advisor'] ?? 0,
    visits_completed: byStatus['completed'] ?? 0,
    matches: matches ?? 0,
  }
}

async function summarize(metrics: Record<string, unknown>): Promise<string> {
  const system =
    'Sos el asistente de una inmobiliaria que le informa a un PROPIETARIO el ' +
    'estado de comercialización de su propiedad. Usá solo los datos provistos, ' +
    'sé claro, cordial y breve (máx 6 líneas). No inventes ni prometas resultados.'
  const result = await runLLM({
    messages: [{ role: 'user', content: `Datos:\n${JSON.stringify(metrics)}\n\nRedactá el informe para el dueño.` }],
    system,
    complexity: 'simple',
    maxTokens: 300,
  })
  return result.text
}
