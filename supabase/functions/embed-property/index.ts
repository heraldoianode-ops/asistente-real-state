// Embedding pipeline for cross-agent matching (F021).
// ES: Genera embeddings 768-dim con Google text-embedding-004 (Gemini API) y,
//     para propiedades, dispara match-properties. Reemplaza al Ollama interno
//     del stack docker archivado, que no es alcanzable desde serverless.
// EN: Generates 768-dim embeddings with Google text-embedding-004 (Gemini API)
//     and, for properties, fires match-properties. Replaces the internal Ollama
//     of the archived docker stack, unreachable from serverless.
//
// POST { property_id }  → embed properties.embedding + run cross-agent matching
// POST { client_id }    → embed clients.preference_embedding
//
// Requires secret GEMINI_API_KEY (Google AI / Generative Language API).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const EMBED_MODEL = 'text-embedding-004' // 768 dimensions, matches the schema

// Google Generative Language API embedContent → 768-dim vector.
async function embed(text: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text }] } }) },
  )
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Gemini ${res.status}: ${e?.error?.message ?? res.statusText}`) }
  const j = await res.json()
  const values = j?.embedding?.values
  if (!Array.isArray(values) || !values.length) throw new Error('Gemini returned no embedding')
  return values
}

// pgvector input literal: '[v1,v2,...]'
const toVector = (v: number[]) => `[${v.join(',')}]`
const clean = (s: unknown) => (typeof s === 'string' ? s.trim() : '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY not set' }, 500)

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'asistente_real_state' } })
    const { property_id, client_id } = await req.json().catch(() => ({}))

    if (property_id) {
      const { data: p, error } = await supabase.from('properties')
        .select('id,title,address,neighborhood,city,property_type,operation_type,bedrooms,bathrooms,price,description,amenities').eq('id', property_id).single()
      if (error || !p) return json({ error: 'property not found' }, 404)
      const text = [
        clean(p.title), clean(p.address), clean(p.neighborhood), clean(p.city),
        clean(p.property_type), clean(p.operation_type),
        p.bedrooms ? `${p.bedrooms} amb` : '', p.bathrooms ? `${p.bathrooms} baños` : '',
        p.price ? `$${p.price}` : '', clean(p.description),
        Array.isArray(p.amenities) ? p.amenities.join(' ') : '',
      ].filter(Boolean).join('. ')
      const vector = await embed(text)
      const { error: upErr } = await supabase.from('properties').update({ embedding: toVector(vector) }).eq('id', property_id)
      if (upErr) throw upErr
      // Fire cross-agent matching (service-role authenticates the internal call).
      let matches: unknown = null
      const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/match-properties`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({ property_id }),
      }).catch(() => null)
      if (r?.ok) matches = await r.json().catch(() => null)
      return json({ ok: true, target: 'property', dim: vector.length, matches })
    }

    if (client_id) {
      const { data: c, error } = await supabase.from('clients')
        .select('id,preferred_operation,preferred_property_type,preferred_neighborhoods,budget,min_bedrooms,notes').eq('id', client_id).single()
      if (error || !c) return json({ error: 'client not found' }, 404)
      const text = [
        clean(c.preferred_operation), clean(c.preferred_property_type),
        Array.isArray(c.preferred_neighborhoods) ? c.preferred_neighborhoods.join(' ') : '',
        c.budget ? `presupuesto $${c.budget}` : '', c.min_bedrooms ? `${c.min_bedrooms}+ amb` : '',
        clean(c.notes),
      ].filter(Boolean).join('. ')
      const vector = await embed(text)
      const { error: upErr } = await supabase.from('clients').update({ preference_embedding: toVector(vector) }).eq('id', client_id)
      if (upErr) throw upErr
      return json({ ok: true, target: 'client', dim: vector.length })
    }

    return json({ error: 'property_id or client_id required' }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
