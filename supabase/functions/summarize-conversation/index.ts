import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUMMARY_PROMPT = `You are a real estate assistant analyst. Given a list of WhatsApp messages between an agent and a client, extract a structured summary.

Return ONLY valid JSON with this exact schema:
{
  "preferences": {
    "zones": [],
    "property_type": null,
    "operation": null,
    "min_bedrooms": null,
    "max_budget": null,
    "currency": "USD",
    "amenities": [],
    "other": []
  },
  "objections": [],
  "operation_status": "exploring|interested|visit_scheduled|negotiating|closing|lost",
  "key_facts": [],
  "next_steps": [],
  "sentiment": "positive|neutral|negative"
}

Rules:
- Extract ONLY what is explicitly stated in the messages
- If a field has no data, use null for scalars or [] for arrays
- operation_status must be one of the enum values
- objections: things the client pushed back on or expressed concern about
- key_facts: important details mentioned (family size, timeline, financing, etc.)
- next_steps: actions pending for agent or client`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'asistente_real_state' } },
    )

    const { client_id } = await req.json()
    if (!client_id) {
      return new Response(JSON.stringify({ error: 'client_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id,full_name,assigned_agent_id')
      .eq('id', client_id)
      .single()

    if (!client) {
      return new Response(JSON.stringify({ error: 'client not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: messages } = await supabase
      .from('interactions')
      .select('content,direction,interaction_type,created_at')
      .eq('client_id', client_id)
      .eq('summarized', false)
      .order('created_at', { ascending: true })
      .limit(100)

    if (!messages?.length) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no unsummarized messages' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const transcript = messages.map((m) => {
      const sender = m.direction === 'in' ? 'CLIENT' : 'AGENT'
      return `[${m.created_at}] ${sender}: ${m.content}`
    }).join('\n')

    const llmUrl = Deno.env.get('LLM_API_URL')
    const llmKey = Deno.env.get('LLM_API_KEY')
    const llmModel = Deno.env.get('LLM_MODEL') || 'claude-sonnet-4-6'

    let summaryJson: Record<string, unknown>

    if (llmUrl?.includes('anthropic') || (!llmUrl && llmKey)) {
      const apiUrl = llmUrl || 'https://api.anthropic.com/v1/messages'
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': llmKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: llmModel,
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `${SUMMARY_PROMPT}\n\n--- MESSAGES ---\n${transcript}`,
          }],
        }),
      })
      const result = await res.json()
      const text = result.content?.[0]?.text ?? '{}'
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      summaryJson = JSON.parse(jsonMatch?.[0] ?? '{}')
    } else if (llmUrl?.includes('openai') || llmUrl?.includes('ollama')) {
      const res = await fetch(llmUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(llmKey ? { 'Authorization': `Bearer ${llmKey}` } : {}),
        },
        body: JSON.stringify({
          model: llmModel,
          messages: [
            { role: 'system', content: SUMMARY_PROMPT },
            { role: 'user', content: transcript },
          ],
          temperature: 0.1,
        }),
      })
      const result = await res.json()
      const text = result.choices?.[0]?.message?.content ?? '{}'
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      summaryJson = JSON.parse(jsonMatch?.[0] ?? '{}')
    } else {
      return new Response(JSON.stringify({ error: 'LLM_API_URL or LLM_API_KEY (Anthropic) must be set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const periodStart = messages[0].created_at
    const periodEnd = messages[messages.length - 1].created_at

    const { data: summary, error: insertErr } = await supabase
      .from('conversation_summaries')
      .insert({
        client_id,
        agent_id: client.assigned_agent_id,
        summary_json: summaryJson,
        raw_message_count: messages.length,
        period_start: periodStart,
        period_end: periodEnd,
      })
      .select('id')
      .single()

    if (insertErr) throw insertErr

    // Mark interactions as summarized
    const messageIds = messages.map((m) => m.created_at)
    await supabase
      .from('interactions')
      .update({ summarized: true })
      .eq('client_id', client_id)
      .eq('summarized', false)
      .lte('created_at', periodEnd)

    // Update client preferences from summary
    const prefs = summaryJson.preferences as Record<string, unknown> | undefined
    if (prefs) {
      const updates: Record<string, unknown> = {}
      if (prefs.zones && (prefs.zones as string[]).length) updates.preferred_neighborhoods = prefs.zones
      if (prefs.property_type) updates.preferred_property_type = prefs.property_type
      if (prefs.operation) updates.preferred_operation = prefs.operation
      if (prefs.min_bedrooms) updates.min_bedrooms = prefs.min_bedrooms
      if (prefs.max_budget) updates.budget = prefs.max_budget
      if (prefs.currency) updates.currency = prefs.currency
      if (Object.keys(updates).length) {
        await supabase.from('clients').update(updates).eq('id', client_id)
      }
    }

    // Update lead stage from operation_status
    const statusToStage: Record<string, string> = {
      exploring: 'new',
      interested: 'contacted',
      visit_scheduled: 'visit_scheduled',
      negotiating: 'negotiating',
      closing: 'closing',
      lost: 'closed_lost',
    }
    const newStage = statusToStage[summaryJson.operation_status as string]
    if (newStage) {
      await supabase.from('clients').update({ lead_stage: newStage }).eq('id', client_id)
    }

    // Generate embedding text for semantic search
    const embeddingText = [
      `Client: ${client.full_name}`,
      `Preferences: ${JSON.stringify(summaryJson.preferences)}`,
      `Objections: ${(summaryJson.objections as string[] ?? []).join(', ')}`,
      `Status: ${summaryJson.operation_status}`,
      `Key facts: ${(summaryJson.key_facts as string[] ?? []).join(', ')}`,
    ].join(' | ')

    // Generate embedding via Gemini text-embedding-004
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    let embeddingVector: string | null = null
    if (geminiKey) {
      const embedModel = 'text-embedding-004'
      const embedRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${embedModel}:embedContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: `models/${embedModel}`, content: { parts: [{ text: embeddingText }] } }),
        },
      )
      const embedJson = await embedRes.json()
      const values = embedJson?.embedding?.values as number[] | undefined
      if (values?.length) {
        embeddingVector = `[${values.join(',')}]`
      }
    }

    // Store embedding in conversation_summaries
    if (embeddingVector) {
      await supabase
        .from('conversation_summaries')
        .update({ embedding: embeddingVector })
        .eq('id', summary.id)
    }

    // Index as RAG document with embedding
    await supabase.from('rag_documents').insert({
      title: `Conversation summary: ${client.full_name} (${periodEnd})`,
      source: `conversation_summary:${summary.id}`,
      chunk_index: 0,
      content: embeddingText,
      ...(embeddingVector ? { embedding: embeddingVector } : {}),
    })

    return new Response(JSON.stringify({
      ok: true,
      summary_id: summary.id,
      messages_processed: messages.length,
      preferences_updated: !!prefs && Object.keys(prefs).length > 0,
      lead_stage: newStage ?? 'unchanged',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
