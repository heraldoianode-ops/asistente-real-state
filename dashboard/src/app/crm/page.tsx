'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { StatusBadge } from '@/components/StatusBadge'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getAgentName } from '@/lib/formatters'
import { Search, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react'

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

const STAGE_LABEL: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', qualified: 'Calificado',
  visit_scheduled: 'Visita agend.', negotiating: 'Negociando',
  closing: 'Cerrando', closed_won: 'Ganado', closed_lost: 'Perdido',
}

const PAGE_SIZE = 50

interface ClientForm {
  full_name: string; phone: string; email: string; client_type: string
  budget: string; currency: string; preferred_operation: string
  preferred_property_type: string; notes: string
}

const EMPTY_FORM: ClientForm = {
  full_name: '', phone: '', email: '', client_type: 'buyer',
  budget: '', currency: 'USD', preferred_operation: '',
  preferred_property_type: '', notes: '',
}

export default function CRMPage() {
  const { user } = useCurrentUser()
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
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
    try {
      const { data, count, error: err } = await q
      if (err) throw err
      setClients((data as unknown as Client[]) ?? [])
      setTotal(count ?? 0)
    } catch (err: unknown) {
      console.error('[crm] Failed to load clients:', err)
      setError('No se pudieron cargar los clientes. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [user, page])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setFormError(null); setSaving(true)
    try {
      const row = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        client_type: form.client_type,
        currency: form.currency || 'USD',
        budget: form.budget ? Number(form.budget) : null,
        preferred_operation: form.preferred_operation.trim() || null,
        preferred_property_type: form.preferred_property_type.trim() || null,
        notes: form.notes.trim() || null,
        assigned_agent_id: user.id,
      }
      const { error: insErr } = await createClient().from('clients').insert(row)
      if (insErr) throw new Error(insErr.message)
      setShowModal(false)
      setForm(EMPTY_FORM)
      await load()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el cliente')
    } finally {
      setSaving(false)
    }
  }

  const filtered = clients.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search)
  )

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex h-screen bg-[hsl(var(--background))]">
      <Sidebar role={user?.role} />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">CRM — Clientes</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{total} clientes en total</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o teléfono…"
                className="pl-9 pr-4 py-2 text-sm border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] w-64"
              />
            </div>
            <button data-testid="btn-create-client" onClick={() => { setForm(EMPTY_FORM); setFormError(null); setShowModal(true) }}
              className="flex items-center gap-2 bg-[hsl(var(--primary))] hover:opacity-90 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              <UserPlus className="w-4 h-4" /> Nuevo cliente
            </button>
          </div>
        </div>
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive mb-4">
            {error}
          </div>
        )}
        <div className="card-creatio overflow-hidden">
          {loading
            ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
            : filtered.length === 0
              ? <div className="text-center py-16 text-sm text-[hsl(var(--muted-foreground))]">{search ? 'Sin resultados.' : 'No hay clientes registrados.'}</div>
              : <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                      {['Nombre', 'Teléfono', 'Tipo', 'Etapa', 'Presupuesto', ...(user?.role === 'admin' ? ['Agente'] : [])].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(var(--border))]">
                    {filtered.map(c => (
                      <tr key={c.id} className="hover:bg-[hsl(var(--secondary))] transition-colors">
                        <td className="px-4 py-3 font-medium">{c.full_name}</td>
                        <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{c.phone ?? '—'}</td>
                        <td className="px-4 py-3"><StatusBadge label={c.client_type === 'buyer' ? 'Comprador' : 'Vendedor'} variant={c.client_type === 'buyer' ? 'active' : 'pending'} /></td>
                        <td className="px-4 py-3">{STAGE_LABEL[c.lead_stage] ?? c.lead_stage}</td>
                        <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{c.budget ? `${c.currency ?? 'USD'} ${c.budget.toLocaleString()}` : '—'}</td>
                        {user?.role === 'admin' && <td className="px-4 py-3 text-[hsl(var(--muted-foreground))] text-xs">{getAgentName(c.users)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
          }
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-[hsl(var(--muted-foreground))]">
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

        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
              <div className="px-6 py-4 border-b border-[hsl(var(--border))]"><h2 className="text-base font-semibold">Nuevo cliente</h2></div>
              <div className="px-6 py-4 space-y-4">
                {formError && <div className="p-3 rounded-md bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))] text-sm">{formError}</div>}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Nombre completo<span className="text-red-500 ml-0.5">*</span></label>
                  <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required
                    className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Teléfono</label>
                    <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Tipo</label>
                    <select value={form.client_type} onChange={e => setForm({ ...form, client_type: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                      <option value="buyer">Comprador</option>
                      <option value="seller">Vendedor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Operación buscada</label>
                    <input value={form.preferred_operation} onChange={e => setForm({ ...form, preferred_operation: e.target.value })} placeholder="venta / alquiler"
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1.5">Presupuesto</label>
                    <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Moneda</label>
                    <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                      <option value="USD">USD</option>
                      <option value="ARS">ARS</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Tipo de propiedad preferida</label>
                  <input value={form.preferred_property_type} onChange={e => setForm({ ...form, preferred_property_type: e.target.value })} placeholder="departamento / casa / PH…"
                    className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Notas</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                    className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-[hsl(var(--border))] flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-[hsl(var(--border))] rounded-md text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-[hsl(var(--primary))] hover:opacity-90 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50">{saving ? 'Guardando…' : 'Crear cliente'}</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
