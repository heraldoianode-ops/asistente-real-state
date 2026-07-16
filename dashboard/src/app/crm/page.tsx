'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/AppShell'
import { StatusBadge } from '@/components/StatusBadge'
import { Modal } from '@/components/Modal'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getAgentName, formatMoney, STAGE_LABEL } from '@/lib/formatters'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Client {
  id: string
  full_name: string
  client_type: string
  lead_stage: string
  phone: string | null
  budget: number | null
  currency: string | null
  assigned_agent_id: string
  users: { full_name: string | null } | { full_name: string | null }[] | null
}

const PAGE_SIZE = 50

export default function CRMPage() {
  const { user } = useCurrentUser()
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    let q = supabase
      .from('clients')
      .select('id, full_name, client_type, lead_stage, phone, budget, currency, assigned_agent_id, users(full_name)', { count: 'exact' })
      .order('full_name')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (user.role !== 'admin') q = q.eq('assigned_agent_id', user.id)
    ;(async () => {
      try {
        const { data, count, error: err } = await q
        if (err) throw err
        setClients((data as unknown as Client[]) ?? [])
        setTotal(count ?? 0)
        setLoading(false)
      } catch (err: unknown) {
        console.error('[crm] Failed to load clients:', err)
        setError('No se pudieron cargar los clientes. Intentá de nuevo.')
        setLoading(false)
      }
    })()
  }, [user, page])

  const filtered = clients.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search)
  )

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <AppShell title="CRM — Clientes">
      <div className="flex items-center justify-between mb-4.5" style={{ marginBottom: 18 }}>
        <div className="text-[13px] text-[hsl(var(--muted-foreground))]">{total} clientes en total</div>
        <div className="relative w-70" style={{ width: 280 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="crm-client-search"
            className="w-full pl-3.5 pr-3.5 py-2 text-sm border border-[hsl(var(--border))] rounded-[9px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
          />
        </div>
      </div>
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive mb-4">{error}</div>
      )}
      <div className="bg-white border border-[hsl(var(--border))] rounded-[14px] overflow-hidden">
        {loading
          ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
          : filtered.length === 0
            ? <div className="text-center py-16 text-sm text-[hsl(var(--muted-foreground))]">{search ? 'Sin resultados.' : 'No hay clientes registrados.'}</div>
            : <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[hsl(var(--secondary))]">
                    {['Nombre', 'Teléfono', 'Tipo', 'Etapa', 'Presupuesto', ...(user?.role === 'admin' ? ['Agente'] : [])].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} onClick={() => setSelectedClient(c)} className="border-t border-[#EEF1F5] cursor-pointer hover:bg-[hsl(var(--secondary))] transition-colors">
                      <td className="px-5 py-3 font-semibold">{c.full_name}</td>
                      <td className="px-5 py-3 text-[hsl(var(--muted-foreground))]">{c.phone ?? '—'}</td>
                      <td className="px-5 py-3"><StatusBadge label={c.client_type === 'buyer' ? 'Comprador' : 'Vendedor'} variant={c.client_type === 'buyer' ? 'active' : 'pending'} /></td>
                      <td className="px-5 py-3">{STAGE_LABEL[c.lead_stage] ?? c.lead_stage}</td>
                      <td className="px-5 py-3 text-[hsl(var(--muted-foreground))]">{c.budget ? formatMoney(c.budget, c.currency ?? 'USD') : '—'}</td>
                      {user?.role === 'admin' && <td className="px-5 py-3 text-[hsl(var(--muted-foreground))] text-xs">{getAgentName(c.users)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
        }
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3.5 text-sm text-[hsl(var(--muted-foreground))]">
          <span>Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-md border border-[hsl(var(--border))] disabled:opacity-40 hover:bg-[hsl(var(--secondary))]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-md border border-[hsl(var(--border))] disabled:opacity-40 hover:bg-[hsl(var(--secondary))]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {selectedClient && (
        <Modal onClose={() => setSelectedClient(null)}>
          <div className="p-6.5" style={{ padding: 26 }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-extrabold">{selectedClient.full_name}</div>
              <button onClick={() => setSelectedClient(null)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-lg">✕</button>
            </div>
            <div className="flex gap-2 mb-4">
              <StatusBadge label={selectedClient.client_type === 'buyer' ? 'Comprador' : 'Vendedor'} variant={selectedClient.client_type === 'buyer' ? 'active' : 'pending'} />
              <span className="bg-[#EEF1F5] text-[#3E4C5E] px-2.5 py-0.5 rounded-full text-[11.5px] font-bold">{STAGE_LABEL[selectedClient.lead_stage] ?? selectedClient.lead_stage}</span>
            </div>
            <div className="flex flex-col gap-2.5 text-[13px]">
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Teléfono</span><span className="font-semibold">{selectedClient.phone ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Presupuesto</span><span className="font-semibold">{selectedClient.budget ? formatMoney(selectedClient.budget, selectedClient.currency ?? 'USD') : '—'}</span></div>
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Agente asignado</span><span className="font-semibold">{getAgentName(selectedClient.users)}</span></div>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  )
}
