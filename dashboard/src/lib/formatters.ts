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

export const STAGE_LABEL: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', qualified: 'Calificado',
  visit_scheduled: 'Visita agend.', negotiating: 'Negociando',
  closing: 'Cerrando', closed_won: 'Ganado', closed_lost: 'Perdido',
}

export const PROPERTY_TYPE_LABEL: Record<string, string> = {
  apartment: 'Departamento', house: 'Casa', office: 'Oficina',
  local: 'Local', land: 'Terreno', other: 'Otro',
}

export function formatMoney(amount: number, currency = 'USD'): string {
  return `${currency} ${amount.toLocaleString('es-AR')}`
}

export function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days} día${days !== 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  return `hace ${months} mes${months !== 1 ? 'es' : ''}`
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
