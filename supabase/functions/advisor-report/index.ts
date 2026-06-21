// PropTech AI Platform — F131 Advisor activity report + personalized tips (M3)
//
// Computes an advisor's activity metrics, compares them against the team average,
// derives personalized statistical tips deterministically, and (optionally) phrases
// them on the FREE tier (Ollama via router — zero Claude tokens, P006). On-demand.
// Secret-key protected (P008).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { runLLM } from '../_shared/llm-router.ts'

interface Metrics { listings: number; clients: number; visits_completed: number; visits_pending: number; visits_scheduled: number }
const empty = (): Metrics => ({ listings: 0, clients: 0, visits_completed: 0, visits_pending: 0, visits_scheduled: 0 })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { agent_id, narrative } = await req.json()
    if (!agent_id) return json({ error: 'agent_id required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    const { data: agents } = await supabase.from('users')
      .select('id, full_name, role, is_active').eq('is_active', true)
    const agentIds = new Set((agents ?? [])
      .filter((u: { role: string }) => u.role === 'agent' || u.role === 'admin')
      .map((u: { id: string }) => u.id))
    const targetName = (agents ?? []).find((u: { id: string }) => u.id === agent_id)?.full_name ?? 'asesor'

    const per = new Map<string, Metrics>()
    const bump = (id: string | null, k: keyof Metrics, n = 1) => {
      if (!id || !agentIds.has(id)) return
      const m = per.get(id) ?? empty(); m[k] += n; per.set(id, m)
    }

    const { data: props } = await supabase.from('properties').select('listing_agent_id').limit(5000)
    for (const p of (props ?? [])) bump(p.listing_agent_id, 'listings')
    const { data: clients } = await supabase.from('clients').select('assigned_agent_id').limit(5000)
    for (const c of (clients ?? [])) bump(c.assigned_agent_id, 'clients')
    const { data: events } = await supabase.from('events').select('agent_id, status').eq('event_type', 'visita').limit(5000)
    for (const e of (events ?? [])) {
      if (e.status === 'completed') bump(e.agent_id, 'visits_completed')
      else if (e.status === 'pending_advisor') bump(e.agent_id, 'visits_pending')
      else if (e.status === 'scheduled') bump(e.agent_id, 'visits_scheduled')
    }

    const mine = per.get(agent_id) ?? empty()
    const n = Math.max(1, agentIds.size)
    const sum = empty()
    for (const m of per.values()) (Object.keys(sum) as (keyof Metrics)[]).forEach((k) => sum[k] += m[k])
    const avg = Object.fromEntries((Object.keys(sum) as (keyof Metrics)[]).map((k) => [k, +(sum[k] / n).toFixed(1)])) as unknown as Metrics

    // Deterministic personalized tips (comparison vs team average).
    const tips: string[] = []
    if (mine.listings < avg.listings * 0.7) tips.push('Estás por debajo del promedio en captaciones — enfocá en captar más propiedades.')
    else if (mine.listings > avg.listings * 1.3) tips.push('Vas por encima del promedio en captaciones, ¡buen trabajo!')
    if (mine.visits_pending > 0) tips.push(`Tenés ${mine.visits_pending} visita(s) pendiente(s) de confirmar — coordiná con los interesados.`)
    if (mine.visits_completed < avg.visits_completed * 0.7) tips.push('Tus visitas concretadas están por debajo del promedio — reforzá el seguimiento de los interesados.')
    if (mine.clients > avg.clients * 1.3) tips.push('Tenés muchos clientes activos — priorizá los de mayor avance para no diluir la atención.')
    if (tips.length === 0) tips.push('Tus métricas están en línea con el equipo. ¡Seguí así!')

    let report = null
    if (narrative) {
      const result = await runLLM({
        messages: [{ role: 'user', content:
          `Asesor: ${targetName}\nMétricas: ${JSON.stringify(mine)}\nPromedio equipo: ${JSON.stringify(avg)}\nTips: ${tips.join(' | ')}\n\nRedactá un informe breve y motivador para el asesor.` }],
        system: 'Sos un coach inmobiliario. Informe breve (máx 6 líneas), concreto, sin inventar datos.',
        complexity: 'simple', maxTokens: 300,
      })
      report = result.text
    }

    return json({ agent_id, advisor: targetName, metrics: mine, team_avg: avg, tips, report })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
