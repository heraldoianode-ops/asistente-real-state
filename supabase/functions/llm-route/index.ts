// PropTech AI Platform — F100 LLM Router endpoint (M0)
// Secret-key-protected Edge Function exposing the free-first LLM router (P008).
import { runLLM, type LLMRequest } from '../_shared/llm-router.ts'
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const body = await req.json() as LLMRequest
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return json({ error: 'messages[] required' }, 400)
    }
    const result = await runLLM(body)
    return json(result)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
