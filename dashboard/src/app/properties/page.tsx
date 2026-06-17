'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { StatusBadge } from '@/components/StatusBadge'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase-config'
import { Search, Building2, ExternalLink, UserCog, FileText } from 'lucide-react'

interface Property {
  id: string
  title: string | null
  address: string
  neighborhood: string | null
  property_type: string
  operation_type: string
  status: string
  price: number
  currency: string
  bedrooms: number | null
  source_url: string | null
  listing_agent_id: string | null
}

const PAGE_SIZE = 50

interface PropForm {
  title: string; address: string; neighborhood: string; city: string
  property_type: string; operation_type: string; price: string; currency: string
  bedrooms: string; bathrooms: string; sqm_total: string; source_url: string; description: string
}
const EMPTY_PROP: PropForm = {
  title: '', address: '', neighborhood: '', city: '', property_type: 'departamento',
  operation_type: 'venta', price: '', currency: 'USD', bedrooms: '', bathrooms: '',
  sqm_total: '', source_url: '', description: '',
}

interface OwnerForm { owner_name: string; phone: string; email: string; notes: string }
const EMPTY_OWNER: OwnerForm = { owner_name: '', phone: '', email: '', notes: '' }

const PROP_TYPES = ['departamento', 'casa', 'ph', 'local', 'oficina', 'terreno']
const OPERATIONS = ['venta', 'alquiler']

export default function PropertiesPage() {
  const { user } = useCurrentUser()
  const [props, setProps] = useState<Property[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [showProp, setShowProp] = useState(false)
  const [propForm, setPropForm] = useState<PropForm>(EMPTY_PROP)
  const [propErr, setPropErr] = useState<string | null>(null)
  const [savingProp, setSavingProp] = useState(false)

  const [ownerFor, setOwnerFor] = useState<Property | null>(null)
  const [ownerForm, setOwnerForm] = useState<OwnerForm>(EMPTY_OWNER)
  const [ownerErr, setOwnerErr] = useState<string | null>(null)
  const [savingOwner, setSavingOwner] = useState(false)

  const [reportBusy, setReportBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  async function sendOwnerReport(p: Property) {
    setReportBusy(p.id); setToast(null)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/owner-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ property_id: p.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Error')
      setToast(data.ok ? `Reporte enviado a ${data.sent}/${data.recipients} propietario(s).` : `No se envió: ${data.reason ?? 'sin teléfono de propietario'}`)
    } catch (err: unknown) {
      setToast(err instanceof Error ? err.message : 'Error al enviar el reporte')
    } finally {
      setReportBusy(null)
    }
  }

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setError(null)
    try {
      const { data, count, error: err } = await createClient()
        .from('properties')
        .select('id, title, address, neighborhood, property_type, operation_type, status, price, currency, bedrooms, source_url, listing_agent_id', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (err) throw err
      setProps((data as unknown as Property[]) ?? [])
      setTotal(count ?? 0)
    } catch (err: unknown) {
      console.error('[properties] load failed:', err)
      setError('No se pudieron cargar los inmuebles.')
    } finally {
      setLoading(false)
    }
  }, [user, page])

  useEffect(() => { load() }, [load])

  async function createProperty(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setPropErr(null); setSavingProp(true)
    try {
      if (!propForm.price) throw new Error('El precio es obligatorio.')
      const row = {
        title: propForm.title.trim() || null,
        address: propForm.address.trim(),
        neighborhood: propForm.neighborhood.trim() || null,
        city: propForm.city.trim() || null,
        property_type: propForm.property_type,
        operation_type: propForm.operation_type,
        price: Number(propForm.price),
        currency: propForm.currency || 'USD',
        bedrooms: propForm.bedrooms ? Number(propForm.bedrooms) : null,
        bathrooms: propForm.bathrooms ? Number(propForm.bathrooms) : null,
        sqm_total: propForm.sqm_total ? Number(propForm.sqm_total) : null,
        source_url: propForm.source_url.trim() || null,
        description: propForm.description.trim() || null,
        listing_agent_id: user.id,
      }
      const { error: insErr } = await createClient().from('properties').insert(row)
      if (insErr) throw new Error(insErr.message)
      setShowProp(false); setPropForm(EMPTY_PROP)
      await load()
    } catch (err: unknown) {
      setPropErr(err instanceof Error ? err.message : 'No se pudo crear el inmueble')
    } finally {
      setSavingProp(false)
    }
  }

  async function createOwner(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !ownerFor) return
    setOwnerErr(null); setSavingOwner(true)
    try {
      const row = {
        property_id: ownerFor.id,
        listing_agent_id: user.id,
        owner_name: ownerForm.owner_name.trim() || null,
        phone: ownerForm.phone.trim() || null,
        email: ownerForm.email.trim() || null,
        notes: ownerForm.notes.trim() || null,
      }
      const { error: insErr } = await createClient().from('property_owner_contacts').insert(row)
      if (insErr) throw new Error(insErr.message)
      setOwnerFor(null); setOwnerForm(EMPTY_OWNER)
    } catch (err: unknown) {
      setOwnerErr(err instanceof Error ? err.message : 'No se pudo guardar el propietario')
    } finally {
      setSavingOwner(false)
    }
  }

  const filtered = props.filter(p =>
    p.address.toLowerCase().includes(search.toLowerCase()) ||
    (p.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.neighborhood ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex h-screen bg-[hsl(var(--background))]">
      <Sidebar role={user?.role} />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Inmuebles</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{total} inmuebles en total</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por dirección o zona…"
                className="pl-9 pr-4 py-2 text-sm border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] w-64" />
            </div>
            <button data-testid="btn-create-property" onClick={() => { setPropForm(EMPTY_PROP); setPropErr(null); setShowProp(true) }}
              className="flex items-center gap-2 bg-[hsl(var(--primary))] hover:opacity-90 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              <Building2 className="w-4 h-4" /> Nuevo inmueble
            </button>
          </div>
        </div>
        {error && <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive mb-4">{error}</div>}
        {toast && <div className="rounded-md bg-[hsl(var(--accent))] p-3 text-sm mb-4">{toast}</div>}
        <div className="card-creatio overflow-hidden">
          {loading
            ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
            : filtered.length === 0
              ? <div className="text-center py-16 text-sm text-[hsl(var(--muted-foreground))]">{search ? 'Sin resultados.' : 'No hay inmuebles registrados.'}</div>
              : <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                      {['Dirección', 'Zona', 'Tipo', 'Operación', 'Precio', 'Link', 'Acciones'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(var(--border))]">
                    {filtered.map(p => (
                      <tr key={p.id} className="hover:bg-[hsl(var(--secondary))] transition-colors">
                        <td className="px-4 py-3 font-medium">{p.title || p.address}</td>
                        <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{p.neighborhood ?? '—'}</td>
                        <td className="px-4 py-3 capitalize">{p.property_type}</td>
                        <td className="px-4 py-3"><StatusBadge label={p.operation_type === 'venta' ? 'Venta' : 'Alquiler'} variant={p.operation_type === 'venta' ? 'active' : 'pending'} /></td>
                        <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{p.currency} {p.price?.toLocaleString()}</td>
                        <td className="px-4 py-3">{p.source_url
                          ? <a href={p.source_url} target="_blank" rel="noreferrer" className="text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" /> Ver</a>
                          : <span className="text-[hsl(var(--muted-foreground))]">—</span>}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button data-testid={`owner-${p.id}`} onClick={() => { setOwnerFor(p); setOwnerForm(EMPTY_OWNER); setOwnerErr(null) }}
                              className="text-xs font-medium text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-1"><UserCog className="w-3.5 h-3.5" /> Propietario</button>
                            <button data-testid={`report-${p.id}`} onClick={() => sendOwnerReport(p)} disabled={reportBusy === p.id}
                              className="text-xs font-medium text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-1 disabled:opacity-50"><FileText className="w-3.5 h-3.5" /> {reportBusy === p.id ? 'Enviando…' : 'Reporte'}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-[hsl(var(--muted-foreground))]">
            <span>Página {page + 1} de {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-md border border-[hsl(var(--border))] disabled:opacity-40 hover:bg-[hsl(var(--secondary))]">Anterior</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-md border border-[hsl(var(--border))] disabled:opacity-40 hover:bg-[hsl(var(--secondary))]">Siguiente</button>
            </div>
          </div>
        )}

        {showProp && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <form onSubmit={createProperty} className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
              <div className="px-6 py-4 border-b border-[hsl(var(--border))]"><h2 className="text-base font-semibold">Nuevo inmueble</h2></div>
              <div className="px-6 py-4 space-y-4">
                {propErr && <div className="p-3 rounded-md bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))] text-sm">{propErr}</div>}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Título</label>
                  <input value={propForm.title} onChange={e => setPropForm({ ...propForm, title: e.target.value })}
                    className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Dirección<span className="text-red-500 ml-0.5">*</span></label>
                  <input value={propForm.address} onChange={e => setPropForm({ ...propForm, address: e.target.value })} required
                    className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Zona / Barrio</label>
                    <input value={propForm.neighborhood} onChange={e => setPropForm({ ...propForm, neighborhood: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Ciudad</label>
                    <input value={propForm.city} onChange={e => setPropForm({ ...propForm, city: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Tipo</label>
                    <select value={propForm.property_type} onChange={e => setPropForm({ ...propForm, property_type: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                      {PROP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Operación</label>
                    <select value={propForm.operation_type} onChange={e => setPropForm({ ...propForm, operation_type: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                      {OPERATIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1.5">Precio<span className="text-red-500 ml-0.5">*</span></label>
                    <input type="number" value={propForm.price} onChange={e => setPropForm({ ...propForm, price: e.target.value })} required
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Moneda</label>
                    <select value={propForm.currency} onChange={e => setPropForm({ ...propForm, currency: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                      <option value="USD">USD</option>
                      <option value="ARS">ARS</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Dormitorios</label>
                    <input type="number" value={propForm.bedrooms} onChange={e => setPropForm({ ...propForm, bedrooms: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Baños</label>
                    <input type="number" value={propForm.bathrooms} onChange={e => setPropForm({ ...propForm, bathrooms: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">m² totales</label>
                    <input type="number" value={propForm.sqm_total} onChange={e => setPropForm({ ...propForm, sqm_total: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Link a la propiedad</label>
                  <input type="url" value={propForm.source_url} onChange={e => setPropForm({ ...propForm, source_url: e.target.value })} placeholder="https://…"
                    className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Descripción</label>
                  <textarea value={propForm.description} onChange={e => setPropForm({ ...propForm, description: e.target.value })} rows={2}
                    className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-[hsl(var(--border))] flex gap-2 justify-end">
                <button type="button" onClick={() => setShowProp(false)} className="px-4 py-2 border border-[hsl(var(--border))] rounded-md text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors">Cancelar</button>
                <button type="submit" disabled={savingProp} className="px-4 py-2 bg-[hsl(var(--primary))] hover:opacity-90 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50">{savingProp ? 'Guardando…' : 'Crear inmueble'}</button>
              </div>
            </form>
          </div>
        )}

        {ownerFor && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <form onSubmit={createOwner} className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-[hsl(var(--border))]">
                <h2 className="text-base font-semibold">Propietario</h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{ownerFor.title || ownerFor.address}</p>
              </div>
              <div className="px-6 py-4 space-y-4">
                {ownerErr && <div className="p-3 rounded-md bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))] text-sm">{ownerErr}</div>}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Nombre del propietario</label>
                  <input value={ownerForm.owner_name} onChange={e => setOwnerForm({ ...ownerForm, owner_name: e.target.value })}
                    className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Teléfono</label>
                    <input value={ownerForm.phone} onChange={e => setOwnerForm({ ...ownerForm, phone: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Email</label>
                    <input type="email" value={ownerForm.email} onChange={e => setOwnerForm({ ...ownerForm, email: e.target.value })}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Notas</label>
                  <textarea value={ownerForm.notes} onChange={e => setOwnerForm({ ...ownerForm, notes: e.target.value })} rows={2}
                    className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]" />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-[hsl(var(--border))] flex gap-2 justify-end">
                <button type="button" onClick={() => setOwnerFor(null)} className="px-4 py-2 border border-[hsl(var(--border))] rounded-md text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors">Cancelar</button>
                <button type="submit" disabled={savingOwner} className="px-4 py-2 bg-[hsl(var(--primary))] hover:opacity-90 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50">{savingOwner ? 'Guardando…' : 'Guardar propietario'}</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
