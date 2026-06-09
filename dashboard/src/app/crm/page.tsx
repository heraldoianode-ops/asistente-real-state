'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { StatusBadge } from '@/components/StatusBadge'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Search } from 'lucide-react'

interface Client { id: string; full_name: string; client_type: string; lead_stage: string; phone: string | null; budget: number | null; currency: string | null; agent_id: string; users: { full_name: string | null } | null }

const STAGE_LABEL: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', qualified: 'Calificado',
  visit_scheduled: 'Visita agend.', negotiating: 'Negociando',
  closing: 'Cerrando', closed_won: 'Ganado', closed_lost: 'Perdido',
}

export default function CRMPage() {
  const { user } = useCurrentUser()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    let q = supabase.from('clients').select('id,full_name,client_type,lead_stage,phone,budget,currency,agent_id,users(full_name)').order('full_name')
    if (user.role !== 'admin') q = q.eq('agent_id', user.id)
    q.then(({ data }) => { setClients((data as Client[]) ?? []); setLoading(false) })
  }, [user])

  const filtered = clients.filter(c => c.full_name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search))

  return (
    <div className="flex h-screen bg-[hsl(var(--background))]">
      <Sidebar role={user?.role} />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">CRM — Clientes</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{clients.length} clientes</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono…"
              className="pl-9 pr-4 py-2 text-sm border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] w-64" />
          </div>
        </div>
        <div className="card-creatio overflow-hidden">
          {loading ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
          : filtered.length===0 ? <div className="text-center py-16 text-sm text-[hsl(var(--muted-foreground))]">{search?'Sin resultados.':'No hay clientes registrados.'}</div>
          : <table className="w-full text-sm">
              <thead><tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                {['Nombre','Teléfono','Tipo','Etapa','Presupuesto',...(user?.role==='admin'?['Agente']:[])].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {filtered.map(c=>(
                  <tr key={c.id} className="hover:bg-[hsl(var(--secondary))] transition-colors">
                    <td className="px-4 py-3 font-medium">{c.full_name}</td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{c.phone??'—'}</td>
                    <td className="px-4 py-3"><StatusBadge label={c.client_type==='buyer'?'Comprador':'Vendedor'} variant={c.client_type==='buyer'?'active':'pending'} /></td>
                    <td className="px-4 py-3">{STAGE_LABEL[c.lead_stage]??c.lead_stage}</td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{c.budget?`${c.currency??'USD'} ${c.budget.toLocaleString()}`:'—'}</td>
                    {user?.role==='admin'&&<td className="px-4 py-3 text-[hsl(var(--muted-foreground))] text-xs">{c.users?.full_name??'—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>}
        </div>
      </main>
    </div>
  )
}
