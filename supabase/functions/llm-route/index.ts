// PropTech AI Platform — F100 LLM Router endpoint (M0)
// Secret-key-protected Edge Function exposing the free-first LLM router.
// Auth (P008): callers must present x-internal-key matching INTERNAL_API_KEY.
import { runLLM, type LLMRequest } from '../_shared/llm-router.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-internal-key' }
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const secret = Deno.env.get('INTERNAL_API_KEY')
  if (!secret || req.headers.get('x-internal-key') !== secret) {
    return json({ error: 'unauthorized' }, 401)
  }

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
