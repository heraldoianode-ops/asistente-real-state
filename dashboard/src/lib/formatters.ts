// Normaliza datos de join relacional de Supabase (devuelve objeto o array)
export function pickFirst<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null
  return Array.isArray(val) ? (val[0] ?? null) : val
}

export function getPropLabel(
  p: { address: string | null; neighborhood: string | null } | { address: string | null; neighborhood: string | null }[] | null
): string {
  const item = pickFirst(p)
  return item?.address ?? item?.neighborhood ?? '—'
}

export function getAgentName(
  u: { full_name: string | null } | { full_name: string | null }[] | null
): string {
  return pickFirst(u)?.full_name ?? '—'
}
