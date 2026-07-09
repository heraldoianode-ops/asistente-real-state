'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { StatusBadge } from '@/components/StatusBadge'
import { createClient } from '@/lib/supabase'
import { Users, Building2, MessageSquare, Phone } from 'lucide-react'

interface Stats { agents: number; properties: number; matches: number; wa_numbers: number }

export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({ agents: 0, properties: 0, matches: 0, wa_numbers: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }).neq('role', 'admin'),
      supabase.from('properties').select('id', { count: 'exact', head: true }),
      supabase.from('cross_agent_matches').select('id', { count: 'exact', head: true }),
      supabase.from('whatsapp_numbers').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ])
      .then(([a, p, m, w]) => {
        setStats({ agents: a.count ?? 0, properties: p.count ?? 0, matches: m.count ?? 0, wa_numbers: w.count ?? 0 })
        setLoading(false)
      })
      .catch((err: unknown) => {
        console.error('[admin] Failed to load stats:', err)
        setError('No se pudieron cargar las estadísticas. Intentá de nuevo.')
        setLoading(false)
      })
  }, [])

  const CARDS = [
    { label: 'Agentes activos', value: stats.agents, icon: Users, href: '/admin/agents' },
    { label: 'Propiedades', value: stats.properties, icon: Building2, href: '/crm' },
    { label: 'Coincidencias', value: stats.matches, icon: MessageSquare, href: '/analytics' },
    { label: 'Números WA activos', value: stats.wa_numbers, icon: Phone, href: '/admin/whatsapp' },
  ]

  return (
    <AppShell title="Administración">
      <div className="mb-6">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Resumen de la plataforma</p>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {CARDS.map(({ label, value, icon: Icon, href }) => (
                <a key={label} href={href} className="card-creatio p-5 hover:shadow-md transition-shadow block">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{label}</span>
                    <div className="w-8 h-8 rounded-md bg-[hsl(var(--accent))] flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[hsl(var(--primary))]" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold">{value}</p>
                </a>
              ))}
            </div>
            <div className="mt-6 card-creatio p-5">
              <h2 className="text-sm font-semibold mb-3">Estado de la plataforma</h2>
              <div className="flex flex-wrap gap-3">
                {[['Supabase', 'Base de datos'], ['Auth', 'Autenticación'], ['Edge Functions', 'Matching']].map(([label, desc]) => (
                  <div key={label} className="flex items-center gap-2 text-sm">
                    <StatusBadge label={label} active />
                    <span className="text-[hsl(var(--muted-foreground))]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
    </AppShell>
  )
}
