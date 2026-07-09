'use client'
import { useEffect, useMemo, useState } from 'react'
import { Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/AppShell'
import { StatusBadge } from '@/components/StatusBadge'
import { Modal, ModalHeader } from '@/components/Modal'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getPropLabel } from '@/lib/formatters'
import { formatMoney, relativeTime, STAGE_LABEL, PROPERTY_TYPE_LABEL, initialsOf } from '@/lib/formatters'
import { CHART_PALETTE, conicGradient, multiConicGradient, lastNMonths, toChartPoints, toAreaPoints } from '@/lib/chart'

interface PropertyRow {
  id: string
  title: string | null
  address: string
  neighborhood: string | null
  city: string | null
  property_type: string
  operation_type: string
  price: number
  currency: string
  is_featured: boolean
  created_at: string
}
interface ClientRow { id: string; lead_stage: string; created_at: string }
interface InquiryRow {
  id: string
  content: string | null
  created_at: string
  clients: { full_name: string } | { full_name: string }[] | null
}
interface MatchRow {
  id: string
  explanation: string
  similarity_score: number
  status: string
  created_at: string
  properties: { address: string | null; neighborhood: string | null } | { address: string | null; neighborhood: string | null }[] | null
}

const AVATAR_COLORS = ['#0070CC', '#22A050', '#E29612', '#DF2060', '#7D5FC7']

export default function DashboardPage() {
  const { user } = useCurrentUser()
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [visitsThisMonth, setVisitsThisMonth] = useState(0)
  const [inquiries, setInquiries] = useState<InquiryRow[]>([])
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProperty, setSelectedProperty] = useState<PropertyRow | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<MatchRow | null>(null)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const isAdmin = user.role === 'admin'
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    let clientsQuery = supabase.from('clients').select('id, lead_stage, created_at').order('created_at', { ascending: false }).limit(2000)
    if (!isAdmin) clientsQuery = clientsQuery.eq('agent_id', user.id)

    let eventsQuery = supabase.from('events').select('id', { count: 'exact', head: true }).gte('scheduled_at', monthStart)
    if (!isAdmin) eventsQuery = eventsQuery.eq('agent_id', user.id)

    let inquiriesQuery = supabase
      .from('interactions')
      .select('id, content, created_at, clients(full_name)')
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(3)
    if (!isAdmin) inquiriesQuery = inquiriesQuery.eq('agent_id', user.id)

    let matchesQuery = supabase
      .from('cross_agent_matches')
      .select('id, explanation, similarity_score, status, created_at, properties(address, neighborhood)')
      .order('created_at', { ascending: false })
      .limit(5)
    if (!isAdmin) matchesQuery = matchesQuery.eq('listing_agent_id', user.id)

    Promise.all([
      supabase.from('properties').select('id, title, address, neighborhood, city, property_type, operation_type, price, currency, is_featured, created_at').limit(3000),
      clientsQuery,
      eventsQuery,
      inquiriesQuery,
      matchesQuery,
    ])
      .then(([p, c, ev, inq, m]) => {
        if (p.error) throw p.error
        if (c.error) throw c.error
        if (inq.error) throw inq.error
        if (m.error) throw m.error
        setProperties((p.data as unknown as PropertyRow[]) ?? [])
        setClients((c.data as unknown as ClientRow[]) ?? [])
        setVisitsThisMonth(ev.count ?? 0)
        setInquiries((inq.data as unknown as InquiryRow[]) ?? [])
        setMatches((m.data as unknown as MatchRow[]) ?? [])
        setLoading(false)
      })
      .catch((err: unknown) => {
        console.error('[dashboard] Failed to load data:', err)
        setError('No se pudieron cargar los datos. Intentá de nuevo.')
        setLoading(false)
      })
  }, [user])

  const derived = useMemo(() => {
    const forSale = properties.filter(p => p.operation_type === 'sale')
    const forRent = properties.filter(p => p.operation_type === 'rent')

    const months = lastNMonths(8)
    const inMonth = (dateStr: string, y: number, mo: number) => {
      const d = new Date(dateStr)
      return d.getFullYear() === y && d.getMonth() === mo
    }
    const ventasVals = months.map(({ year, month }) => forSale.filter(p => inMonth(p.created_at, year, month)).length)
    const alquileresVals = months.map(({ year, month }) => forRent.filter(p => inMonth(p.created_at, year, month)).length)
    const maxVal = Math.max(1, ...ventasVals, ...alquileresVals)
    const ventasPoints = toChartPoints(ventasVals, maxVal)
    const alquileresPoints = toChartPoints(alquileresVals, maxVal)
    const areaPoints = toAreaPoints(ventasPoints)

    const now = new Date()
    const thisMonth = { y: now.getFullYear(), mo: now.getMonth() }
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonth = { y: last.getFullYear(), mo: last.getMonth() }
    const countIn = (rows: { created_at: string }[], { y, mo }: { y: number; mo: number }) =>
      rows.filter(r => inMonth(r.created_at, y, mo)).length
    const pctVs = (curr: number, prev: number) => (prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(Math.min(100, (curr / prev) * 100)))

    const propsThisMonth = countIn(properties, thisMonth)
    const propsLastMonth = countIn(properties, lastMonth)
    const clientsThisMonth = countIn(clients, thisMonth)
    const clientsLastMonth = countIn(clients, lastMonth)
    const newLeads = clients.filter(c => c.lead_stage === 'new')
    const leadsThisMonth = countIn(newLeads, thisMonth)
    const leadsLastMonth = countIn(newLeads, lastMonth)

    const kpiCards = [
      { value: propsThisMonth, label: 'Propiedades nuevas vs. mes anterior', pct: pctVs(propsThisMonth, propsLastMonth), color: CHART_PALETTE[0] },
      { value: clientsThisMonth, label: 'Nuevos clientes vs. mes anterior', pct: pctVs(clientsThisMonth, clientsLastMonth), color: CHART_PALETTE[1] },
      { value: leadsThisMonth, label: 'Nuevos leads vs. mes anterior', pct: pctVs(leadsThisMonth, leadsLastMonth), color: CHART_PALETTE[3] },
    ]

    const typeCounts = new Map<string, number>()
    properties.forEach(p => typeCounts.set(p.property_type, (typeCounts.get(p.property_type) ?? 0) + 1))
    const propertyTypes = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count], i) => ({
        label: PROPERTY_TYPE_LABEL[type] ?? type,
        pct: properties.length ? Math.round((count / properties.length) * 100) : 0,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
      }))
    const propertyDonutBg = multiConicGradient(propertyTypes)

    const cityCounts = new Map<string, number>()
    properties.forEach(p => { if (p.city) cityCounts.set(p.city, (cityCounts.get(p.city) ?? 0) + 1) })
    const cityEntries = Array.from(cityCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const maxCity = Math.max(1, ...cityEntries.map(([, n]) => n))
    const cities = cityEntries.map(([name, count], i) => ({
      name, count, color: CHART_PALETTE[i % CHART_PALETTE.length], widthPct: Math.round((count / maxCity) * 100),
    }))

    const featured = properties.filter(p => p.is_featured)
    const featuredProperties = (featured.length > 0 ? featured : [...properties].sort((a, b) => b.created_at.localeCompare(a.created_at))).slice(0, 4)

    return {
      statCards: [
        { label: 'Propiedades en venta', value: forSale.length, color: CHART_PALETTE[0] },
        { label: 'Propiedades en alquiler', value: forRent.length, color: CHART_PALETTE[1] },
        { label: 'Visitas agendadas / mes', value: visitsThisMonth, color: CHART_PALETTE[2] },
        { label: 'Total inmuebles', value: properties.length, color: CHART_PALETTE[3] },
      ],
      chartMonths: months.map(m => m.label),
      ventasPoints, alquileresPoints, areaPoints,
      ventasTotal: forSale.length, alquileresTotal: forRent.length,
      kpiCards, propertyTypes, propertyDonutBg,
      cities, featuredProperties,
    }
  }, [properties, clients, visitsThisMonth])

  return (
    <AppShell title="Panel de control">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">{error}</div>
      ) : (
        <>
          {/* stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4.5 mb-5" style={{ gap: 18 }}>
            {derived.statCards.map(card => (
              <div key={card.label} className="rounded-2xl p-5 text-white relative overflow-hidden"
                style={{ background: card.color, boxShadow: `0 8px 20px -8px ${card.color}` }}>
                <div className="absolute -right-4.5 -top-4.5 w-[90px] h-[90px] rounded-full bg-white/[.14]" style={{ right: -18, top: -18 }} />
                <div className="text-[32px] font-extrabold relative">{card.value}</div>
                <div className="text-[12.5px] font-medium opacity-90 mt-1 relative">{card.label}</div>
              </div>
            ))}
          </div>

          {/* chart row */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] gap-4.5 mb-4.5 items-stretch" style={{ gap: 18 }}>
            <div className="bg-white rounded-[14px] border border-[hsl(var(--border))] p-5">
              <div className="text-sm font-bold mb-1.5">Estadísticas de operaciones anuales</div>
              <div className="flex gap-5 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: CHART_PALETTE[0] }} />
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Total ventas</span>
                  <span className="text-[13px] font-bold">{derived.ventasTotal} Propiedades</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: CHART_PALETTE[1] }} />
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Total alquileres</span>
                  <span className="text-[13px] font-bold">{derived.alquileresTotal} Propiedades</span>
                </div>
              </div>
              <svg viewBox="0 0 640 190" width="100%" height="170" preserveAspectRatio="none">
                <polygon points={derived.areaPoints} fill="url(#areaGrad)" />
                <polyline points={derived.ventasPoints} fill="none" stroke={CHART_PALETTE[0]} strokeWidth="2.5" />
                <polyline points={derived.alquileresPoints} fill="none" stroke={CHART_PALETTE[1]} strokeWidth="2.5" />
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_PALETTE[0]} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={CHART_PALETTE[0]} stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="flex justify-between px-1">
                {derived.chartMonths.map(m => <span key={m} className="text-[11px] text-[hsl(var(--muted-foreground))]">{m}</span>)}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {derived.kpiCards.map(k => (
                <div key={k.label} className="bg-white rounded-[14px] border border-[hsl(var(--border))] px-4 py-3.5 flex items-center justify-between flex-1">
                  <div>
                    <div className="text-[22px] font-extrabold">{k.value}</div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] leading-snug max-w-[110px]">{k.label}</div>
                  </div>
                  <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center shrink-0" style={{ background: conicGradient(k.pct, k.color, '#EEF1F5') }}>
                    <div className="w-[38px] h-[38px] rounded-full bg-white flex items-center justify-center text-[11px] font-bold" style={{ color: k.color }}>{k.pct}%</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[14px] border border-[hsl(var(--border))] p-5">
              <div className="text-sm font-bold mb-3.5">Tipos de inmueble</div>
              {derived.propertyTypes.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Sin propiedades cargadas.</p>
              ) : (
                <>
                  <div className="flex flex-col gap-2 mb-4">
                    {derived.propertyTypes.map(t => (
                      <div key={t.label} className="flex items-center gap-2 text-xs">
                        <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: t.color }} />
                        <span className="text-[#3E4C5E] flex-1">{t.label}</span>
                        <span className="font-bold">{t.pct}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-center">
                    <div className="w-[120px] h-[120px] rounded-full flex items-center justify-center" style={{ background: derived.propertyDonutBg }}>
                      <div className="w-[78px] h-[78px] rounded-full bg-white flex flex-col items-center justify-center">
                        <div className="text-xl font-extrabold">{properties.length}</div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">inmuebles</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* lower row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4.5" style={{ gap: 18 }}>
            <div className="bg-white rounded-[14px] border border-[hsl(var(--border))] p-5">
              <div className="text-sm font-bold mb-3">Consultas recientes</div>
              {inquiries.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Sin consultas recientes.</p>
              ) : inquiries.map((q, i) => {
                const client = Array.isArray(q.clients) ? q.clients[0] : q.clients
                const name = client?.full_name ?? 'Cliente'
                return (
                  <div key={q.id} className="flex gap-2.5 py-2.5 border-t first:border-t-0 border-[#EEF1F5]">
                    <div className="w-[34px] h-[34px] rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{initialsOf(name)}</div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[12.5px] font-bold">{name}</span>
                        <span className="text-[10.5px] text-[hsl(var(--muted-foreground))]">{relativeTime(q.created_at)}</span>
                      </div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))] leading-snug mt-0.5 line-clamp-2">{q.content ?? '—'}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="bg-white rounded-[14px] border border-[hsl(var(--border))] p-5">
              <div className="text-sm font-bold mb-3.5">Localización de inmuebles</div>
              {derived.cities.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Sin datos de ciudad.</p>
              ) : derived.cities.map(c => (
                <div key={c.name} className="mb-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{c.count} inmuebles</span>
                  </div>
                  <div className="h-1.5 rounded bg-[#EEF1F5] overflow-hidden">
                    <div className="h-full rounded" style={{ background: c.color, width: `${c.widthPct}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[14px] border border-[hsl(var(--border))] p-5">
              <div className="text-sm font-bold mb-3.5">Clientes recientes</div>
              {clients.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Sin clientes registrados.</p>
              ) : [...clients].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4).map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-t first:border-t-0 border-[#EEF1F5]">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">{STAGE_LABEL[c.lead_stage] ?? c.lead_stage}</div>
                    <div className="text-[10.5px] text-[hsl(var(--muted-foreground))]">{relativeTime(c.created_at)}</div>
                  </div>
                  <StatusBadge label={STAGE_LABEL[c.lead_stage] ?? c.lead_stage} variant={c.lead_stage.startsWith('closed_won') ? 'active' : c.lead_stage === 'closed_lost' ? 'inactive' : 'pending'} />
                </div>
              ))}
            </div>
          </div>

          {/* coincidencias recientes */}
          <div className="bg-white rounded-[14px] border border-[hsl(var(--border))] mt-4.5 overflow-hidden" style={{ marginTop: 18 }}>
            <div className="px-5 py-4 border-b border-[#EEF1F5] flex items-center justify-between">
              <div className="text-sm font-bold">Coincidencias recientes (IA)</div>
              <span className="text-[11.5px] text-[hsl(var(--muted-foreground))]">Click para ver detalle</span>
            </div>
            {matches.length === 0 ? (
              <div className="text-center py-10 text-sm text-[hsl(var(--muted-foreground))]">Sin coincidencias aún.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[hsl(var(--secondary))]">
                    {['Propiedad', 'Explicación', 'Similitud', 'Estado', 'Fecha'].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matches.map(m => (
                    <tr key={m.id} onClick={() => setSelectedMatch(m)} className="border-t border-[#EEF1F5] cursor-pointer hover:bg-[hsl(var(--secondary))] transition-colors">
                      <td className="px-5 py-2.5 font-semibold">{getPropLabel(m.properties)}</td>
                      <td className="px-5 py-2.5 text-[hsl(var(--muted-foreground))] max-w-[260px] truncate">{m.explanation}</td>
                      <td className="px-5 py-2.5 font-bold">{Math.round(m.similarity_score * 100)}%</td>
                      <td className="px-5 py-2.5">
                        <StatusBadge label={m.status === 'pending' ? 'Pendiente' : m.status === 'accepted' ? 'Aceptado' : 'Rechazado'}
                          variant={m.status === 'pending' ? 'pending' : m.status === 'accepted' ? 'active' : 'inactive'} />
                      </td>
                      <td className="px-5 py-2.5 text-[hsl(var(--muted-foreground))] text-xs">{new Date(m.created_at).toLocaleDateString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* propiedades destacadas */}
          <div className="mt-4.5" style={{ marginTop: 18 }}>
            <div className="text-sm font-bold mb-3">
              Propiedades destacadas <span className="font-normal text-[hsl(var(--muted-foreground))] text-xs">— click para ver detalle</span>
            </div>
            {derived.featuredProperties.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">No hay propiedades cargadas todavía.</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {derived.featuredProperties.map((p, i) => (
                  <div key={p.id} onClick={() => setSelectedProperty(p)}
                    className="bg-white border border-[hsl(var(--border))] rounded-[14px] overflow-hidden cursor-pointer transition-shadow hover:shadow-[0_6px_18px_-6px_rgba(24,43,63,.18)]">
                    <div className="h-24 flex items-center justify-center relative" style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}>
                      <Building2 className="w-[30px] h-[30px] text-white/85" strokeWidth={1.6} />
                      <span className="absolute top-2.5 right-2.5 bg-black/35 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {p.operation_type === 'sale' ? 'Venta' : 'Alquiler'}
                      </span>
                    </div>
                    <div className="px-3.5 py-3">
                      <div className="text-[12.5px] font-bold truncate">{p.title ?? p.address}</div>
                      <div className="text-[11.5px] text-[hsl(var(--muted-foreground))] mt-0.5">{p.neighborhood ?? p.city ?? p.address}</div>
                      <div className="text-[13px] font-extrabold mt-2" style={{ color: CHART_PALETTE[0] }}>
                        {formatMoney(p.price, p.currency)}{p.operation_type === 'rent' ? '/mes' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {selectedProperty && (
        <Modal onClose={() => setSelectedProperty(null)} width={440}>
          <div className="h-[130px] relative flex items-center justify-center" style={{ background: CHART_PALETTE[0] }}>
            <Building2 className="w-[38px] h-[38px] text-white/85" strokeWidth={1.6} />
            <button onClick={() => setSelectedProperty(null)}
              className="absolute top-3 right-3 text-white bg-black/30 w-[26px] h-[26px] rounded-full flex items-center justify-center">✕</button>
          </div>
          <div className="p-5.5" style={{ padding: 22 }}>
            <div className="text-base font-extrabold">{selectedProperty.title ?? selectedProperty.address}</div>
            <div className="text-[13px] text-[hsl(var(--muted-foreground))] mt-0.5">{selectedProperty.neighborhood ?? selectedProperty.city ?? selectedProperty.address}</div>
            <div className="flex gap-2 my-3.5">
              <span className="bg-[#DFEFFB] text-[#0070CC] px-2.5 py-0.5 rounded-full text-[11.5px] font-bold">{selectedProperty.operation_type === 'sale' ? 'Venta' : 'Alquiler'}</span>
              <span className="bg-[#EEF1F5] text-[#3E4C5E] px-2.5 py-0.5 rounded-full text-[11.5px] font-bold">{PROPERTY_TYPE_LABEL[selectedProperty.property_type] ?? selectedProperty.property_type}</span>
            </div>
            <div className="text-[22px] font-extrabold" style={{ color: CHART_PALETTE[0] }}>
              {formatMoney(selectedProperty.price, selectedProperty.currency)}{selectedProperty.operation_type === 'rent' ? '/mes' : ''}
            </div>
          </div>
        </Modal>
      )}

      {selectedMatch && (
        <Modal onClose={() => setSelectedMatch(null)} width={460}>
          <ModalHeader title={getPropLabel(selectedMatch.properties)} onClose={() => setSelectedMatch(null)} />
          <div className="px-6 pb-6 pt-3.5">
            <div className="text-[13px] text-[#3E4C5E] leading-relaxed mb-4">{selectedMatch.explanation}</div>
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: conicGradient(Math.round(selectedMatch.similarity_score * 100), CHART_PALETTE[0], '#EEF1F5') }}>
                <div className="w-[42px] h-[42px] rounded-full bg-white flex items-center justify-center text-xs font-extrabold" style={{ color: CHART_PALETTE[0] }}>
                  {Math.round(selectedMatch.similarity_score * 100)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">Similitud IA</div>
                <StatusBadge label={selectedMatch.status === 'pending' ? 'Pendiente' : selectedMatch.status === 'accepted' ? 'Aceptado' : 'Rechazado'}
                  variant={selectedMatch.status === 'pending' ? 'pending' : selectedMatch.status === 'accepted' ? 'active' : 'inactive'} />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  )
}
