'use client'
import { useEffect, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { StatusBadge } from '@/components/StatusBadge'
import { createClient } from '@/lib/supabase'
import { SUPABASE_URL } from '@/lib/supabase-config'
import { UserPlus, RefreshCw } from 'lucide-react'

interface Agent { id: string; email: string; full_name: string | null; role: string; is_active: boolean; wa_contact_id: string | null; avatar_url: string | null; created_at: string }
interface CreateForm { email: string; full_name: string; password: string; wa_contact_id: string }

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CreateForm>({ email: '', full_name: '', password: '', wa_contact_id: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  async function loadAgents() {
    setLoading(true)
    const { data } = await createClient().from('users').select('id,email,full_name,role,is_active,wa_contact_id,avatar_url,created_at').neq('role','admin').order('created_at',{ascending:false})
    setAgents(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAgents() }, [])

  async function handleToggle(agent: Agent) {
    await createClient().from('users').update({ is_active: !agent.is_active }).eq('id', agent.id)
    await loadAgents()
  }

  async function handleAvatarUpload(agent: Agent, file: File) {
    setAvatarError(null)
    if (!file.type.startsWith('image/')) { setAvatarError('El archivo debe ser una imagen.'); return }
    if (file.size > 5 * 1024 * 1024) { setAvatarError('La imagen no puede superar 5 MB.'); return }
    setUploadingId(agent.id)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${agent.id}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: true })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('users').update({ avatar_url: pub.publicUrl }).eq('id', agent.id)
      if (dbErr) throw new Error(dbErr.message)
      await loadAgents()
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'Error al subir la foto')
    } finally { setUploadingId(null) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setFormError(null); setSaving(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) throw new Error('Sesión expirada. Volvé a iniciar sesión.')
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e?.error ?? 'Error') }
      setShowModal(false)
      setForm({ email: '', full_name: '', password: '', wa_contact_id: '' })
      await loadAgents()
    } catch (err: unknown) { setFormError(err instanceof Error ? err.message : 'Error') }
    finally { setSaving(false) }
  }

  return (
    <AdminGuard>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Agentes</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{agents.length} agente{agents.length !== 1 ? 's' : ''} registrado{agents.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAgents} className="p-2 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors"><RefreshCw className="w-4 h-4" /></button>
            <button data-testid="btn-create-agent" onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-[hsl(var(--primary))] hover:bg-[hsl(207,100%,35%)] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              <UserPlus className="w-4 h-4" /> Nuevo agente
            </button>
          </div>
        </div>
        {avatarError && <div className="mb-4 p-3 rounded-md bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))] text-sm">{avatarError}</div>}
        <div className="card-creatio overflow-hidden">
          {loading ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
          : agents.length === 0 ? <div className="text-center py-16 text-sm text-[hsl(var(--muted-foreground))]">No hay agentes registrados</div>
          : <table className="w-full text-sm">
              <thead><tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                {['Foto','Nombre','Email','WA Contact','Estado','Acción'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {agents.map(a=>(
                  <tr key={a.id} className="hover:bg-[hsl(var(--secondary))] transition-colors">
                    <td className="px-4 py-3">
                      <label className="cursor-pointer inline-block" title="Subir foto desde PC o teléfono">
                        {a.avatar_url
                          ? /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={a.avatar_url} alt={a.full_name ?? a.email} className="w-9 h-9 rounded-full object-cover border border-[hsl(var(--border))]" />
                          : <span className="w-9 h-9 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--primary))] flex items-center justify-center text-xs font-semibold uppercase">
                              {uploadingId === a.id ? '…' : (a.full_name ?? a.email).slice(0, 2)}
                            </span>}
                        <input type="file" accept="image/*" className="hidden" data-testid={`avatar-${a.id}`}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(a, f); e.target.value = '' }} />
                      </label>
                    </td>
                    <td className="px-4 py-3 font-medium">{a.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{a.email}</td>
                    <td className="px-4 py-3 font-mono text-xs">{a.wa_contact_id ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge label={a.is_active?'Activo':'Inactivo'} active={a.is_active} /></td>
                    <td className="px-4 py-3"><button data-testid={`toggle-agent-${a.id}`} onClick={()=>handleToggle(a)} className="text-xs font-medium text-[hsl(var(--primary))] hover:underline">{a.is_active?'Desactivar':'Activar'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>}
        </div>
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleCreate} className="bg-card text-card-foreground rounded-xl shadow-2xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-[hsl(var(--border))]"><h2 className="text-base font-semibold">Nuevo agente</h2></div>
              <div className="px-6 py-4 space-y-4">
                {formError && <div className="p-3 rounded-md bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))] text-sm">{formError}</div>}
                {(['email','full_name','password','wa_contact_id'] as const).map(field=>(
                  <div key={field}>
                    <label className="block text-sm font-medium mb-1.5 capitalize">{field.replace(/_/g,' ')}{field!=='wa_contact_id'&&<span className="text-red-500 ml-0.5">*</span>}</label>
                    <input type={field==='password'?'password':'text'} value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent"
                      required={field!=='wa_contact_id'} />
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-[hsl(var(--border))] flex gap-2 justify-end">
                <button type="button" onClick={()=>setShowModal(false)} className="px-4 py-2 border border-[hsl(var(--border))] rounded-md text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-[hsl(var(--primary))] hover:bg-[hsl(207,100%,35%)] text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50">{saving?'Creando…':'Crear agente'}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminGuard>
  )
}
