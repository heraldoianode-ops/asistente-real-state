// PropTech AI Platform — F122 Hidden interlinked-business detection (M2)
//
// Surfaces LATENT interlinks nobody is working: a person (by phone) who owns
// 2+ agency properties is a hidden deal chain (selling one could fund buying/
// holding another). Discards pairs already recorded as ACTIVE (F121 handles
// those), records the rest as link_type='hidden' (status 'candidate' — analyze
// before validate), and emits notifications for the martillero + the listing
// advisors of both properties. Deterministic, zero LLM cost. Secret-key (P008).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    // Owners with multiple agency properties → latent chains.
    const { data: contacts } = await supabase.from('property_owner_contacts')
      .select('phone, owner_name, property_id').not('phone', 'is', null)

    const byPhone = new Map<string, { name?: string; props: Set<string> }>()
    for (const c of (contacts ?? [])) {
      const e = byPhone.get(c.phone) ?? { name: c.owner_name, props: new Set<string>() }
      e.props.add(c.property_id)
      byPhone.set(c.phone, e)
    }

    // Existing ACTIVE pairs to discard (unordered).
    const { data: actives } = await supabase.from('interlink_matches')
      .select('property_id, linked_property_id').eq('link_type', 'active')
    const activePairs = new Set<string>()
    for (const a of (actives ?? [])) {
      activePairs.add([a.property_id, a.linked_property_id].sort().join('|'))
    }

    const martillera = (await supabase.from('app_settings')
      .select('value').eq('key', 'wa_martillera').maybeSingle()).data?.value ?? null

    const hidden = []
    for (const [phone, info] of byPhone) {
      const props = [...info.props]
      if (props.length < 2) continue
      const primary = props[0]
      for (const linked of props.slice(1)) {
        if (activePairs.has([primary, linked].sort().join('|'))) continue // discard active

        const explanation =
          `Entrelazamiento OCULTO: ${info.name ?? 'un propietario'} (tel ${phone}) posee ` +
          `${props.length} propiedades en la agencia; posible cadena de negocio no trabajada.`

        const { data: inserted } = await supabase.from('interlink_matches')
          .upsert({
            property_id: primary,
            client_id: null,
            linked_property_id: linked,
            link_type: 'hidden',
            similarity: null,
            explanation,
            status: 'candidate',
          }, { onConflict: 'property_id,client_id,linked_property_id' })
          .select('id').single()
        if (!inserted) continue

        // Notification targets: martillero + listing advisors of both properties.
        const { data: agents } = await supabase.from('properties')
          .select('listing_agent_id').in('id', [primary, linked])
        const advisor_ids = [...new Set((agents ?? [])
          .map((a: { listing_agent_id: string | null }) => a.listing_agent_id)
          .filter(Boolean))]

        hidden.push({
          interlink_id: inserted.id,
          property_id: primary,
          linked_property_id: linked,
          explanation,
          notify: { martillera, advisor_ids, message: explanation },
        })
      }
    }

    return json({ hidden, total: hidden.length })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
