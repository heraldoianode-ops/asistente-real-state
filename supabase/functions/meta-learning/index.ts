// PropTech AI Platform — F115 Independent IA + meta-learning (M1)
//
// Mines closed chats for what worked / what failed and produces assertive-
// communication tips, to optimize attention over time. Two modes:
//   analyze  — analyze one conversation (free tier, Ollama) → store insights.
//   digest   — synthesize recent insights into guidance. FREE by default;
//              escalates to Claude ONLY when adminRequest === true (D016) —
//              this is the "tarea potente de análisis/reporte" the admin can ask for.
// Zero Claude tokens unless an admin explicitly requests the heavy digest.
// Secret-key protected (P008). No web access (D019).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { runLLM } from '../_shared/llm-router.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const body = await req.json()
    const mode = body.mode ?? 'analyze'
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    if (mode === 'analyze') return await analyze(supabase, body)
    if (mode === 'digest') return await digest(supabase, body)
    return json({ error: "mode must be 'analyze' or 'digest'" }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function analyze(supabase: any, body: { conversation_id?: string; outcome?: string }) {
  if (!body.conversation_id) return json({ error: 'conversation_id required' }, 400)

  const { data: conv } = await supabase.from('chat_conversations')
    .select('id, context, summary, outcome').eq('id', body.conversation_id).maybeSingle()
  if (!conv) return json({ error: 'conversation not found' }, 404)

  if (body.outcome) {
    await supabase.from('chat_conversations')
      .update({ outcome: body.outcome }).eq('id', conv.id)
  }
  const outcome = body.outcome ?? conv.outcome ?? 'open'

  const { data: msgs } = await supabase.from('chat_messages')
    .select('role, content').eq('conversation_id', conv.id)
    .order('created_at', { ascending: true }).limit(40)
  const transcript = (msgs ?? [])
    .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n')

  const system =
    'Analizás una conversación inmobiliaria por WhatsApp para que el equipo ' +
    'mejore. Sé concreto y breve. Devolvé 3 secciones cortas:\n' +
    'FUNCIONO: qué se hizo bien.\nFALLO: qué se pudo mejorar.\n' +
    'TIP: un consejo de comunicación asertiva accionable.'
  // FREE tier — adminRequest false, Claude never used.
  const result = await runLLM({
    messages: [{ role: 'user', content:
      `Contexto: ${conv.context ?? 'n/d'} | Resultado: ${outcome}\n` +
      `Resumen: ${conv.summary ?? '(ninguno)'}\n\nTranscripción:\n${transcript}` }],
    system,
    complexity: 'simple',
    maxTokens: 350,
  })
  const text = result.text ?? ''
  if (!text) return json({ error: 'empty analysis' }, 502)

  const kind = outcome === 'won' ? 'success' : outcome === 'lost' ? 'failure' : 'tip'
  await supabase.from('meta_learning_insights')
    .insert({ conversation_id: conv.id, kind, insight: text })

  return json({ conversation_id: conv.id, outcome, kind, analysis: text })
}

// deno-lint-ignore no-explicit-any
async function digest(supabase: any, body: { adminRequest?: boolean; limit?: number }) {
  const { data: insights } = await supabase.from('meta_learning_insights')
    .select('kind, insight').order('created_at', { ascending: false })
    .limit(Math.min(body.limit ?? 50, 100))
  if (!insights || insights.length === 0) return json({ digest: 'Sin insights acumulados aún.' })

  const corpus = insights
    .map((i: { kind: string; insight: string }) => `[${i.kind}] ${i.insight}`).join('\n---\n')
  const system =
    'Sos un coach del equipo inmobiliario. A partir de los aprendizajes ' +
    'recientes, sintetizá una guía accionable: 3 prioridades para optimizar la ' +
    'atención y 3 tips de comunicación asertiva. Concreto, sin relleno.'

  // Heavy tier ONLY on explicit admin request (D016); otherwise free (Ollama).
  const adminRequest = body.adminRequest === true
  const result = await runLLM({
    messages: [{ role: 'user', content: `Aprendizajes recientes:\n${corpus}` }],
    system,
    complexity: adminRequest ? 'heavy' : 'simple',
    adminRequest,
    maxTokens: 600,
  })

  return json({ digest: result.text, source_count: insights.length, provider: result.provider })
}
