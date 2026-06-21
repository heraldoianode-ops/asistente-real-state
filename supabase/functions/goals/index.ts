// PropTech AI Platform — F130/F131 monthly goals config (M3, D024)
//
//   get  — agency default goals + optional per-advisor override
//   set  — update default goals (scope 'default') or a per-advisor override
//          (scope 'agent'). Intended for the admin/martillero panel.
// Secret-key protected (P008). Dashboard can also write directly via RLS.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'

const KEYS = { captaciones_mes: 'goal_captaciones_mes', ventas_mes: 'goal_ventas_mes', alquileres_mes: 'goal_alquileres_mes' } as const
type GoalKey = keyof typeof KEYS

// deno-lint-ignore no-explicit-any
async function defaults(supabase: any) {
  const { data } = await supabase.from('app_settings').select('key, value')
    .in('key', Object.values(KEYS))
  const map = new Map<string, string>((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
  return Object.fromEntries((Object.keys(KEYS) as GoalKey[])
    .map((k) => [k, map.get(KEYS[k]) != null ? Number(map.get(KEYS[k])) : null]))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action ?? 'get'
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    if (action === 'get') {
      const def = await defaults(supabase)
      let override = null
      if (body.agent_id) {
        const { data } = await supabase.from('advisor_goals')
          .select('captaciones_mes, ventas_mes, alquileres_mes').eq('agent_id', body.agent_id).maybeSingle()
        override = data ?? null
      }
      return json({ default: def, override })
    }

    if (action === 'set') {
      const scope = body.scope ?? 'default'
      const fields = ['captaciones_mes', 'ventas_mes', 'alquileres_mes'] as GoalKey[]

      if (scope === 'default') {
        for (const k of fields) {
          if (body[k] != null) {
            await supabase.from('app_settings')
              .upsert({ key: KEYS[k], value: String(body[k]), updated_at: new Date().toISOString() }, { onConflict: 'key' })
          }
        }
        return json({ scope, default: await defaults(supabase) })
      }

      if (scope === 'agent') {
        if (!body.agent_id) return json({ error: 'agent_id required for scope agent' }, 400)
        const row: Record<string, unknown> = { agent_id: body.agent_id, updated_at: new Date().toISOString() }
        for (const k of fields) if (body[k] != null) row[k] = body[k]
        if (body.updated_by) row.updated_by = body.updated_by
        await supabase.from('advisor_goals').upsert(row, { onConflict: 'agent_id' })
        return json({ scope, agent_id: body.agent_id })
      }
      return json({ error: "scope must be 'default' or 'agent'" }, 400)
    }

    return json({ error: "action must be 'get' or 'set'" }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
