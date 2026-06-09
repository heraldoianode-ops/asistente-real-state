'use client'
import { useEffect, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { StatusBadge } from '@/components/StatusBadge'
import { createClient } from '@/lib/supabase'
import { Plus, RefreshCw } from 'lucide-react'

interface WANumber { id: string; agent_id: string; phone_number: string; phone_number_id: string; display_name: string | null; is_active: boolean }
interface CreateForm { agent_id: string; phone_number: string; phone_number_id: string; display_name: string }

export default function WhatsAppPage() {
  const [numbers, setNumbers] = useState<WANumber[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CreateForm>({ agent_id: '', phone_number: '', phone_number_id: '', display_name: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function loadNumbers() {
    setLoading(true)
    const { data } = await createClient().from('whatsapp_numbers').select('id,agent_id,phone_number,phone_number_id,display_name,is_active').order('phone_number')
    setNumbers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadNumbers() }, [])

  async function handleToggle(n: WANumber) {
    await createClient().from('whatsapp_numbers').update({ is_active: !n.is_active }).eq('id', n.id)
    await loadNumbers()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setFormError(null); setSaving(true)
    try {
      const { error } = await createClient().from('whatsapp_numbers').insert({ agent_id: form.agent_id, phone_number: form.phone_number, phone_number_id: form.phone_number_id, display_name: form.display_name || null, is_active: false })
      if (error) throw new Error(error.message)
      setShowModal(false)
      setForm({ agent_id: '', phone_number: '', phone_number_id: '', display_name: '' })
      await loadNumbers()
    } catch (err: unknown) { setFormError(err instanceof Error ? err.message : 'Error') }
    finally { setSaving(false) }
  }

  return (
    <AdminGuard>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Números WhatsApp</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{numbers.length} número{numbers.length!==1?'s':''} registrado{numbers.length!==1?'s':''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadNumbers} className="p-2 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 bg-[hsl(var(--primary))] hover:bg-[hsl(207,100%,35%)] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Registrar número
            </button>
          </div>
        </div>
        <div className="card-creatio overflow-hidden">
          {loading ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
          : numbers.length===0 ? <div className="text-center py-16 text-sm text-[hsl(var(--muted-foreground))]">No hay números registrados</div>
          : <table className="w-full text-sm">
              <thead><tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                {['Número','Phone ID','Nombre','Agent ID','Estado','Acción'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {numbers.map(n=>(
                  <tr key={n.id} className="hover:bg-[hsl(var(--secondary))] transition-colors">
                    <td className="px-4 py-3 font-medium">{n.phone_number}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--muted-foreground))]">{n.phone_number_id}</td>
                    <td className="px-4 py-3">{n.display_name??'—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--muted-foreground))]">{n.agent_id.slice(0,8)}…</td>
                    <td className="px-4 py-3"><StatusBadge label={n.is_active?'Activo':'Inactivo'} active={n.is_active} /></td>
                    <td className="px-4 py-3"><button data-testid={`toggle-wa-${n.id}`} onClick={()=>handleToggle(n)} className="text-xs font-medium text-[hsl(var(--primary))] hover:underline">{n.is_active?'Deshabilitar':'Habilitar'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>}
        </div>
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-[hsl(var(--border))]"><h2 className="text-base font-semibold">Registrar número WhatsApp</h2></div>
              <div className="px-6 py-4 space-y-4">
                {formError && <div className="p-3 rounded-md bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))] text-sm">{formError}</div>}
                {(['agent_id','phone_number','phone_number_id','display_name'] as const).map(field=>(
                  <div key={field}>
                    <label className="block text-sm font-medium mb-1.5 capitalize">{field.replace(/_/g,' ')}{field!=='display_name'&&<span className="text-red-500 ml-0.5">*</span>}</label>
                    <input type="text" value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})}
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent"
                      required={field!=='display_name'} />
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-[hsl(var(--border))] flex gap-2 justify-end">
                <button type="button" onClick={()=>setShowModal(false)} className="px-4 py-2 border border-[hsl(var(--border))] rounded-md text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-[hsl(var(--primary))] hover:bg-[hsl(207,100%,35%)] text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50">{saving?'Registrando…':'Registrar'}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminGuard>
  )
}
