// PropTech AI Platform — F123 Capture documentation management (M2)
//
// Tracks required documentation per captured property and drives the flow:
//   request  -> ask the owner for missing docs (returns owner notify payload)
//   receive  -> mark a doc received -> forward to martillero to validate
//   validate -> martillero validates/rejects a received doc
//   status   -> list the docs and their states
// Deterministic, zero LLM. The gateway performs the WhatsApp sends. Secret-key (P008).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'

const DEFAULT_DOCS = [
  'escritura', 'plano', 'reglamento_copropiedad',
  'libre_deuda_expensas', 'impuesto_inmobiliario', 'dni_titular',
]

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
    const martillera = () => supabase.from('app_settings').select('value').eq('key', 'wa_martillera').maybeSingle()

    // --- status ---------------------------------------------------------------
    if (action === 'status') {
      const { data: docs } = await supabase.from('capture_documents')
        .select('doc_type, status, file_url').eq('property_id', property_id)
      return json({ property_id, docs: docs ?? [] })
    }

    // --- receive --------------------------------------------------------------
    if (action === 'receive') {
      if (!doc_type) return json({ error: 'doc_type required' }, 400)
      await supabase.from('capture_documents').upsert({
        property_id, doc_type, status: 'received', file_url: file_url ?? null,
        received_at: new Date().toISOString(),
      }, { onConflict: 'property_id,doc_type' })
      const wa = (await martillera()).data?.value ?? null
      return json({
        property_id, doc_type, status: 'received',
        notify: { martillera: wa, message: `Documento recibido para validar: ${doc_type} (propiedad ${property_id}).` },
      })
    }

    // --- validate -------------------------------------------------------------
    if (action === 'validate') {
      if (!doc_type || (decision !== 'validate' && decision !== 'reject')) {
        return json({ error: "doc_type and decision ('validate'|'reject') required" }, 400)
      }
      await supabase.from('capture_documents').update({
        status: decision === 'validate' ? 'validated' : 'rejected',
        validated_at: new Date().toISOString(),
        validated_by: validated_by ?? null,
      }).eq('property_id', property_id).eq('doc_type', doc_type)
      return json({ property_id, doc_type, status: decision === 'validate' ? 'validated' : 'rejected' })
    }

    // --- request (default) ----------------------------------------------------
    const docs = await requiredDocs(supabase)
    const { data: existing } = await supabase.from('capture_documents')
      .select('doc_type, status').eq('property_id', property_id)
    const byType = new Map<string, string>((existing ?? []).map((d: { doc_type: string; status: string }) => [d.doc_type, d.status]))

    // Ensure a row per required doc.
    const toInsert = docs.filter((t) => !byType.has(t))
      .map((t) => ({ property_id, doc_type: t, status: 'required' }))
    if (toInsert.length) await supabase.from('capture_documents').insert(toInsert)

    // Missing = not yet received/validated.
    const missing = docs.filter((t) => !['received', 'validated'].includes(byType.get(t) ?? 'required'))
    if (missing.length) {
      await supabase.from('capture_documents')
        .update({ status: 'requested', requested_at: new Date().toISOString() })
        .eq('property_id', property_id).in('doc_type', missing).neq('status', 'received')
    }

    // Owner contact for the request.
    const { data: owner } = await supabase.from('property_owner_contacts')
      .select('phone, owner_name').eq('property_id', property_id)
      .not('phone', 'is', null).limit(1).maybeSingle()

    return json({
      property_id, missing,
      notify: missing.length && owner?.phone
        ? { to: owner.phone, message: `Para avanzar con la publicación necesitamos: ${missing.join(', ')}. ¿Podés enviarlos por aquí?` }
        : null,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
