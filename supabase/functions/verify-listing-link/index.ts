// PropTech AI Platform — F103 Listing-link verifier (M0)
//
// Decision D019: NO external web access EXCEPT verifying a consulted listing URL.
// This function fetches EXACTLY ONE URL (the link a user shared in chat) to check
// whether it is a property listing. It does NOT crawl, follow links, or search the
// web. Single request, size-capped, timeout-bounded. Secret-key protected (P008).
import { corsHeaders, json, requireInternalKey } from '../_shared/auth.ts'
import { runLLM } from '../_shared/llm-router.ts'

const MAX_BYTES = 512 * 1024 // 512KB cap — we only need the page head/body text
const TIMEOUT_MS = 8000

// Spanish/LatAm real-estate signals.
const SIGNAL_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'precio', re: /\b(precio|usd|u\$s|\$\s?\d|expensas)\b/i },
  { label: 'superficie', re: /\b(m2|m²|metros?\s+cuadrados?|sup\.?\s)/i },
  { label: 'ambientes', re: /\b(ambientes?|dormitorios?|habitaciones?|ba[ñn]os?)\b/i },
  { label: 'operacion', re: /\b(venta|alquiler|alquila|en venta|temporario)\b/i },
  { label: 'tipo', re: /\b(departamento|casa|ph|lote|terreno|oficina|local|cochera)\b/i },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const denied = requireInternalKey(req)
  if (denied) return denied

  try {
    const { url } = await req.json()
    let target: URL
    try {
      target = new URL(url)
    } catch {
      return json({ error: 'valid url required' }, 400)
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return json({ error: 'only http(s) urls allowed' }, 400)
    }

    // Single fetch of the consulted URL only. manual redirect = no silent hops.
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(target.toString(), {
        signal: ctrl.signal,
        redirect: 'follow', // listing shorteners are common; still one logical URL
        headers: { 'user-agent': 'PropTechAI-LinkVerifier/1.0' },
      })
    } finally {
      clearTimeout(t)
    }
    if (!res.ok) return json({ url: target.toString(), reachable: false, status: res.status })

    const buf = new Uint8Array(await res.arrayBuffer())
    const text = new TextDecoder('utf-8', { fatal: false })
      .decode(buf.subarray(0, MAX_BYTES))
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')

    const signals = SIGNAL_PATTERNS.filter((s) => s.re.test(text)).map((s) => s.label)
    // Heuristic verdict: 3+ distinct signals strongly indicates a property listing.
    const heuristicProperty = signals.length >= 3

    return json({
      url: target.toString(),
      reachable: true,
      is_property: heuristicProperty,
      confidence: Math.min(1, signals.length / SIGNAL_PATTERNS.length),
      signals,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    return json({ error: msg, reachable: false }, 500)
  }
})

// Optional deeper check (admin-triggered, free tier) — kept out of the hot path.
// Callers wanting an LLM verdict can pass the extracted text to runLLM with
// complexity 'simple' (Ollama). Exported for reuse by M1/M2.
export async function classifyListingText(text: string): Promise<boolean> {
  const result = await runLLM({
    messages: [{ role: 'user', content:
      `¿El siguiente texto corresponde a un aviso de una propiedad inmobiliaria? ` +
      `Respondé solo "si" o "no".\n\n${text.slice(0, 4000)}` }],
    complexity: 'simple',
    maxTokens: 5,
  })
  return /^\s*s[ií]/i.test(result.text)
}
