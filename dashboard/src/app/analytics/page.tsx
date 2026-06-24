'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { StatusBadge } from '@/components/StatusBadge'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getPropLabel } from '@/lib/formatters'
import { Building2, Users, MessageSquare, TrendingUp, BarChart3, Brain } from 'lucide-react'

interface MatchRow {
  id: string
  explanation: string
  similarity_score: number
  status: string
  created_at: string
  properties: { address: string | null; neighborhood: string | null } | { address: string | null; neighborhood: string | null }[] | null
}
interface Stats { properties: number; clients: number; matches: number; pending_matches: number; interactions: number; summaries: number }
interface FunnelStage { stage: string; count: number }

const STAGE_LABEL: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', qualified: 'Calificado',
  visit_scheduled: 'Visita agend.', negotiating: 'Negociando',
  closing: 'Cerrando', closed_won: 'Ganado', closed_lost: 'Perdido',
}

const STAGE_ORDER = ['new', 'contacted', 'qualified', 'visit_scheduled', 'negotiating', 'closing', 'closed_won', 'closed_lost']

export default function AnalyticsPage() {
  const { user } = useCurrentUser()
  const [stats, setStats] = useState<Stats>({ properties: 0, clients: 0, matches: 0, pending_matches: 0, interactions: 0, summaries: 0 })
  const [recent, setRecent] = useState<MatchRow[]>([])
  const [funnel, setFunnel] = useState<FunnelStage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const isAdmin = user.role === 'admin'

    let recentQuery = supabase
      .from('cross_agent_matches')
      .select('id, explanation, similarity_score, status, created_at, properties(address, neighborhood)')
      .order('created_at', { ascending: false })
      .limit(5)
    if (!isAdmin) recentQuery = recentQuery.eq('listing_agent_id', user.id)

    Promise.all([
      supabase.from('properties').select('id', { count: 'exact', head: true }),
      isAdmin
        ? supabase.from('clients').select('id', { count: 'exact', head: true })
        : supabase.from('clients').select('id', { count: 'exact', head: true }).eq('assigned_agent_id', user.id),
      isAdmin
        ? supabase.from('cross_agent_matches').select('id', { count: 'exact', head: true })
        : supabase.from('cross_agent_matches').select('id', { count: 'exact', head: true }).eq('listing_agent_id', user.id),
      isAdmin
        ? supabase.from('cross_agent_matches').select('id', { count: 'exact', head: true }).eq('status', 'pending')
        : supabase.from('cross_agent_matches').select('id', { count: 'exact', head: true }).eq('listing_agent_id', user.id).eq('status', 'pending'),
      recentQuery,
      // WA interaction count
      isAdmin
        ? supabase.from('interactions').select('id', { count: 'exact', head: true }).eq('interaction_type', 'whatsapp')
        : supabase.from('interactions').select('id', { count: 'exact', head: true }).eq('interaction_type', 'whatsapp').eq('agent_id', user.id),
      // Conversation summaries count
      isAdmin
        ? supabase.from('conversation_summaries').select('id', { count: 'exact', head: true })
        : supabase.from('conversation_summaries').select('id', { count: 'exact', head: true }).eq('agent_id', user.id),
      // Lead funnel
      isAdmin
        ? supabase.from('clients').select('lead_stage')
        : supabase.from('clients').select('lead_stage').eq('assigned_agent_id', user.id),
    ])
      .then(([p, c, m, pm, r, wa, cs, funnelData]) => {
        setStats({
          properties: p.count ?? 0,
          clients: c.count ?? 0,
          matches: m.count ?? 0,
          pending_matches: pm.count ?? 0,
          interactions: wa.count ?? 0,
          summaries: cs.count ?? 0,
        })
        setRecent((r.data as unknown as MatchRow[]) ?? [])

        // Build funnel from client stages
        const stageCounts: Record<string, number> = {}
        for (const row of (funnelData.data ?? []) as { lead_stage: string }[]) {
          stageCounts[row.lead_stage] = (stageCounts[row.lead_stage] ?? 0) + 1
        }
        setFunnel(STAGE_ORDER.map(s => ({ stage: s, count: stageCounts[s] ?? 0 })))

        setLoading(false)
      })
      .catch((err: unknown) => {
        console.error('[analytics] Failed to load data:', err)
        setError('No se pudieron cargar los datos. Intentá de nuevo.')
        setLoading(false)
      })
  }, [user])

  const CARDS = [
    { label: 'Propiedades', value: stats.properties, icon: Building2 },
    { label: 'Clientes', value: stats.clients, icon: Users },
    { label: 'Coincidencias', value: stats.matches, icon: MessageSquare },
    { label: 'Pendientes', value: stats.pending_matches, icon: TrendingUp },
    { label: 'Msgs WhatsApp', value: stats.interactions, icon: BarChart3 },
    { label: 'Resúmenes IA', value: stats.summaries, icon: Brain },
  ]

  const maxFunnel = Math.max(...funnel.map(f => f.count), 1)

  return (
    <div className="flex h-screen bg-[hsl(var(--background))]">
      <Sidebar role={user?.role} />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Analytics</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">Resumen de actividad e inteligencia conversacional</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              {CARDS.map(({ label, value, icon: Icon }) => (
                <div key={label} className="card-creatio p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</span>
                    <div className="w-7 h-7 rounded-md bg-[hsl(var(--accent))] flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{value}</p>
                </div>
              ))}
            </div>

            {/* Lead Funnel */}
            <div className="card-creatio mb-6">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
                <h2 className="text-sm font-semibold">Funnel de conversión</h2>
              </div>
              <div className="p-5 space-y-3">
                {funnel.map(({ stage, count }) => (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] w-28 text-right shrink-0">
                      {STAGE_LABEL[stage] ?? stage}
                    </span>
                    <div className="flex-1 h-7 bg-[hsl(var(--secondary))] rounded-md overflow-hidden">
                      <div
                        className="h-full bg-[hsl(var(--primary))] rounded-md flex items-center px-2 transition-all"
                        style={{ width: `${Math.max((count / maxFunnel) * 100, count > 0 ? 8 : 0)}%` }}
                      >
                        {count > 0 && <span className="text-xs font-semibold text-white">{count}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Matches */}
            <div className="card-creatio overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))]"><h2 className="text-sm font-semibold">Coincidencias recientes</h2></div>
              {recent.length === 0 ? (
                <div className="text-center py-10 text-sm text-[hsl(var(--muted-foreground))]">Sin coincidencias aún.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[hsl(var(--secondary))] border-b border-[hsl(var(--border))]">
                        {['Propiedad', 'Explicación', 'Similitud', 'Estado', 'Fecha'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      {recent.map(m => (
                        <tr key={m.id} className="hover:bg-[hsl(var(--secondary))] transition-colors">
                          <td className="px-4 py-3 font-medium">{getPropLabel(m.properties)}</td>
                          <td className="px-4 py-3 text-[hsl(var(--muted-foreground))] max-w-xs truncate">{m.explanation}</td>
                          <td className="px-4 py-3">{(m.similarity_score * 100).toFixed(0)}%</td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              label={m.status === 'pending' ? 'Pendiente' : m.status === 'accepted' ? 'Aceptado' : 'Rechazado'}
                              variant={m.status === 'pending' ? 'pending' : m.status === 'accepted' ? 'active' : 'inactive'}
                            />
                          </td>
                          <td className="px-4 py-3 text-[hsl(var(--muted-foreground))] text-xs">
                            {new Date(m.created_at).toLocaleDateString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
