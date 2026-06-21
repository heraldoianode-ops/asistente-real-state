// PropTech AI Platform — shared secret-key guard for protected Edge Functions.
// Scheduled jobs (GitHub Actions / Cron-Job.org) and internal callers must
// present x-internal-key === INTERNAL_API_KEY (decisions D018, pattern P008).

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-internal-key',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

/**
 * Returns null when the caller is authorized; otherwise a 401 Response to
 * return immediately. Plain equality check (see TD-009 for timing-safe hardening).
 */
export function requireInternalKey(req: Request): Response | null {
  const secret = Deno.env.get('INTERNAL_API_KEY')
  const provided = req.headers.get('x-internal-key')
  if (!secret || !provided || provided !== secret) {
    return json({ error: 'unauthorized' }, 401)
  }
  return null
}
