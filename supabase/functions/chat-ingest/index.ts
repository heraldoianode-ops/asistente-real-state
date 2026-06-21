// PropTech AI Platform — F102 Chat ingestion + summarization (M0)
//
// Persists WhatsApp messages and keeps a compact, context-preserving summary so
// long conversations stay cheap. Summaries run on the FREE tier (Ollama) via the
// LLM router — zero Claude tokens (pattern P006). Secret-key protected (P008).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { runLLM } from '../_shared/llm-router.ts'

const SUMMARY_EVERY = 20 // messages accumulated before re-summarizing

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { contact_phone, role, content, context } = await req.json()
    if (!contact_phone || !role || !content) {
      return json({ error: 'contact_phone, role, content required' }, 400)
    }
    if (role !== 'user' && role !== 'assistant') {
      return json({ error: "role must be 'user' or 'assistant'" }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    // Upsert conversation by phone, then insert the message.
    const { data: conv } = await supabase
      .from('chat_conversations')
      .upsert({ contact_phone, ...(context ? { context } : {}), updated_at: new Date().toISOString() },
              { onConflict: 'contact_phone' })
      .select('id, messages_since_summary')
      .single()
    if (!conv) return json({ error: 'could not upsert conversation' }, 500)

    await supabase.from('chat_messages').insert({ conversation_id: conv.id, role, content })

    const sinceSummary = (conv.messages_since_summary ?? 0) + 1
    let summarized = false

    if (sinceSummary >= SUMMARY_EVERY) {
      summarized = await resummarize(supabase, conv.id)
      await supabase.from('chat_conversations')
        .update({ messages_since_summary: 0 }).eq('id', conv.id)
    } else {
      await supabase.from('chat_conversations')
        .update({ messages_since_summary: sinceSummary }).eq('id', conv.id)
    }

    return json({ conversation_id: conv.id, summarized })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function resummarize(supabase: any, conversationId: string): Promise<boolean> {
  const { data: prev } = await supabase.from('chat_conversations')
    .select('summary').eq('id', conversationId).single()
  const { data: msgs } = await supabase.from('chat_messages')
    .select('role, content').eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }).limit(SUMMARY_EVERY)

  const recent = (msgs ?? []).reverse()
    .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n')

  const system =
    'Sos un asistente que mantiene un resumen breve y fiel de una conversación ' +
    'inmobiliaria por WhatsApp. Preservá datos clave (intención, propiedad/zona, ' +
    'presupuesto, próximos pasos, compromisos). No inventes. Máximo 8 líneas.'
  const userPrompt =
    `Resumen previo:\n${prev?.summary ?? '(ninguno)'}\n\n` +
    `Mensajes recientes:\n${recent}\n\nActualizá el resumen.`

  // FREE tier only (Ollama) — adminRequest stays false, so Claude is never used.
  const result = await runLLM({
    messages: [{ role: 'user', content: userPrompt }],
    system,
    complexity: 'simple',
    maxTokens: 400,
  })
  if (!result.text) return false

  await supabase.from('chat_conversations')
    .update({ summary: result.text, summary_updated_at: new Date().toISOString() })
    .eq('id', conversationId)
  return true
}
