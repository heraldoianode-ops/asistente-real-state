'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { StatusBadge } from '@/components/StatusBadge'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getPropLabel } from '@/lib/formatters'
import { Building2, Users, MessageSquare, TrendingUp } from 'lucide-react'

interface MatchRow {
  id: string
  explanation: string
  similarity_score: number
  status: string
  created_at: string
  properties: { address: string | null; neighborhood: string | null } | { address: string | null; neighborhood: string | null }[] | null
}
interface Stats { properties: number; clients: number; matches: number; pending_matches: number }

export default function AnalyticsPage() {
  const { user } = useCurrentUser()
  const [stats, setStats] = useState<Stats>({ properties: 0, clients: 0, matches: 0, pending_matches: 0 })
  const [recent, setRecent] = useState<MatchRow[]>([])
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
        : supabase.from('clients').select('id', { count: 'exact', head: true }).eq('agent_id', user.id),
      isAdmin
        ? supabase.from('cross_agent_matches').select('id', { count: 'exact', head: true })
        : supabase.from('cross_agent_matches').select('id', { count: 'exact', head: true }).eq('listing_agent_id', user.id),
      isAdmin
        ? supabase.from('cross_agent_matches').select('id', { count: 'exact', head: true }).eq('status', 'pending')
        : supabase.from('cross_agent_matches').select('id', { count: 'exact', head: true }).eq('listing_agent_id', user.id).eq('status', 'pending'),
      recentQuery,
    ])
      .then(([p, c, m, pm, r]) => {
        setStats({ properties: p.count ?? 0, clients: c.count ?? 0, matches: m.count ?? 0, pending_matches: pm.count ?? 0 })
        setRecent((r.data as unknown as MatchRow[]) ?? [])
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
    { label: 'Coincidencias totales', value: stats.matches, icon: MessageSquare },
    { label: 'Coincidencias pendientes', value: stats.pending_matches, icon: TrendingUp },
  ]

  return (
    <div className="flex h-screen bg-[hsl(var(--background))]">
      <Sidebar role={user?.role} />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Analytics</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">Resumen de actividad</p>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {CARDS.map(({ label, value, icon: Icon }) => (
                <div key={label} className="card-creatio p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{label}</span>
                    <div className="w-8 h-8 rounded-md bg-[hsl(var(--accent))] flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[hsl(var(--primary))]" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-[hsl(var(--foreground))]">{value}</p>
                </div>
              ))}
            </div>
            <div className="card-creatio overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))]"><h2 className="text-sm font-semibold">Coincidencias recientes</h2></div>
              {recent.length === 0 ? (
                <div className="text-center py-10 text-sm text-[hsl(var(--muted-foreground))]">Sin coincidencias aún.</div>
              ) : (
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
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
