// PropTech AI Platform — buyer↔offer match scoring (D022).
//
// Strict, deterministic rules (zero LLM, free):
//  1) Mandatory filters — a property that violates ANY is excluded:
//     - budget: offer.price <= demand.budget * 1.10 (±10% negotiation margin)
//     - zone: offer.neighborhood must be in the target zones, unless the buyer
//       allows "zonas limítrofes"
//     - operation: a buyer ("comprar") only sees 'venta' or permuta-enabled offers
//  2) Affinity score (0-100) over: m² closeness (40), ambientes/dormitorios (35),
//     amenities (25) — weights redistribute over whatever data is available.
//  3) Permuta logic: score > 75 with unmet non-mandatory reqs => 'ajuste_parcial';
//     permuta-enabled offers flagged for possible "permuta cruzada" (cross-check
//     of the buyer's own property against the seller's profile happens upstream).

export interface Demand {
  budget?: number | null
  currency?: string | null
  preferred_operation?: string | null
  preferred_neighborhoods?: string[] | null
  allow_adjacent_zones?: boolean | null
  min_bedrooms?: number | null
  target_sqm?: number | null
  desired_amenities?: string[] | null
}

export interface Offer {
  price?: number | null
  currency?: string | null
  operation_type?: string | null
  accepts_permuta?: boolean | null
  neighborhood?: string | null
  sqm_total?: number | null
  bedrooms?: number | null
  amenities?: string[] | null
  title?: string | null
  address?: string | null
}

export type Classification = 'match' | 'ajuste_parcial' | 'parcial'
export type Confidence = 'alta' | 'media' | 'baja'

// A missing attribute that lowered scoring confidence — routed to the advisor
// who can complete it (offer gaps -> listing agent; demand gaps -> assigned agent).
export interface DataGap { side: 'demand' | 'offer'; label: string }

export interface ScoreResult {
  passes: boolean
  fail_reasons: string[]
  score: number
  classification: Classification | null
  met: string[]
  unmet: string[]
  gaps: DataGap[]
  confidence: Confidence
  permuta_possible: boolean
  explanation: string
}

const ci = (a?: string | null, b?: string | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
const has = (arr: string[] | null | undefined, v: string) =>
  (arr ?? []).some((x) => ci(x, v))

export function scoreMatch(demand: Demand, offer: Offer): ScoreResult {
  const fail: string[] = []
  const met: string[] = []
  const unmet: string[] = []

  // --- 1) Mandatory filters -------------------------------------------------
  // Budget (+10% margin). Skip if currencies differ (cannot compare reliably).
  if (demand.budget != null && offer.price != null) {
    if (demand.currency && offer.currency && !ci(demand.currency, offer.currency)) {
      unmet.push(`moneda distinta (${offer.currency} vs ${demand.currency}), verificar`)
    } else if (offer.price > demand.budget * 1.10) {
      fail.push('precio supera el presupuesto +10%')
    } else {
      met.push('dentro del presupuesto')
    }
  }

  // Zone.
  const zones = demand.preferred_neighborhoods ?? []
  if (zones.length && offer.neighborhood) {
    if (zones.some((z) => ci(z, offer.neighborhood))) {
      met.push('zona objetivo')
    } else if (demand.allow_adjacent_zones) {
      unmet.push('zona limítrofe (fuera del área objetivo)')
    } else {
      fail.push('fuera de la zona objetivo')
    }
  }

  // Operation.
  const op = (demand.preferred_operation ?? '').toLowerCase()
  if (/(compr|venta)/.test(op)) {
    if (ci(offer.operation_type, 'venta') || offer.accepts_permuta) {
      met.push(offer.accepts_permuta && !ci(offer.operation_type, 'venta') ? 'habilitada para permuta' : 'operación venta')
    } else {
      fail.push('la operación de la oferta no es venta ni permuta')
    }
  } else if (/(alqui|renta|arrend)/.test(op)) {
    if (ci(offer.operation_type, 'alquiler')) met.push('operación alquiler')
    else fail.push('la operación de la oferta no es alquiler')
  }

  if (fail.length) {
    return {
      passes: false, fail_reasons: fail, score: 0, classification: null,
      met, unmet, gaps: [], confidence: 'baja', permuta_possible: !!offer.accepts_permuta,
      explanation: `Descartada: ${fail.join('; ')}.`,
    }
  }

  // --- 2) Affinity score ----------------------------------------------------
  const comps: { w: number; v: number }[] = []
  const gaps: DataGap[] = []

  // m² (weight 40). Missing data on either side becomes an advisor request.
  if (demand.target_sqm && demand.target_sqm > 0 && offer.sqm_total && offer.sqm_total > 0) {
    const v = Math.max(0, 1 - Math.abs(demand.target_sqm - offer.sqm_total) / demand.target_sqm)
    comps.push({ w: 0.40, v })
    if (v >= 0.85) met.push('m² acordes'); else unmet.push('m² alejados de lo buscado')
  } else {
    if (!(demand.target_sqm && demand.target_sqm > 0)) gaps.push({ side: 'demand', label: 'm² buscados' })
    if (!(offer.sqm_total && offer.sqm_total > 0)) gaps.push({ side: 'offer', label: 'm² de la propiedad' })
  }

  // Ambientes / dormitorios (weight 35).
  if (demand.min_bedrooms && offer.bedrooms != null) {
    const v = offer.bedrooms >= demand.min_bedrooms ? 1 : offer.bedrooms / demand.min_bedrooms
    comps.push({ w: 0.35, v })
    if (offer.bedrooms >= demand.min_bedrooms) met.push('dormitorios suficientes')
    else unmet.push(`menos dormitorios (${offer.bedrooms}/${demand.min_bedrooms})`)
  } else {
    if (!demand.min_bedrooms) gaps.push({ side: 'demand', label: 'dormitorios buscados' })
    if (offer.bedrooms == null) gaps.push({ side: 'offer', label: 'dormitorios de la propiedad' })
  }

  // Amenidades (weight 25).
  const desired = demand.desired_amenities ?? []
  if (desired.length) {
    const matched = desired.filter((a) => has(offer.amenities, a))
    comps.push({ w: 0.25, v: matched.length / desired.length })
    if (matched.length) met.push(`amenidades: ${matched.join(', ')}`)
    const missing = desired.filter((a) => !has(offer.amenities, a))
    if (missing.length) unmet.push(`sin ${missing.join(', ')}`)
  } else {
    gaps.push({ side: 'demand', label: 'amenidades buscadas' })
  }

  let score: number
  if (comps.length) {
    const wsum = comps.reduce((s, c) => s + c.w, 0)
    score = Math.round((comps.reduce((s, c) => s + c.w * c.v, 0) / wsum) * 100)
  } else {
    score = 70 // passes mandatory filters but no comparable attributes
  }

  // Confidence from how many scoring components had data (3 = full, 0-1 = low).
  const confidence: Confidence = comps.length >= 3 ? 'alta' : comps.length === 2 ? 'media' : 'baja'

  // --- 3) Classification + permuta ------------------------------------------
  const classification: Classification =
    unmet.length === 0 ? 'match' : score >= 75 ? 'ajuste_parcial' : 'parcial'

  const label = offer.title ?? offer.address ?? 'propiedad'
  const metTxt = met.length ? `Cumple: ${met.join(', ')}` : 'Cumple los filtros obligatorios'
  const unmetTxt = unmet.length ? `; requiere aceptar: ${unmet.join(', ')}` : ''
  const tag = classification === 'ajuste_parcial' ? ' [Oportunidad de Ajuste Parcial]' : ''
  const gapTxt = gaps.length ? ` Confianza ${confidence} — faltan datos: ${gaps.map((g) => g.label).join(', ')}.` : ''
  const explanation = `Match del ${score}% — ${label}. ${metTxt}${unmetTxt}.${tag}${gapTxt}`

  return {
    passes: true, fail_reasons: [], score, classification, met, unmet,
    gaps, confidence, permuta_possible: !!offer.accepts_permuta, explanation,
  }
}
