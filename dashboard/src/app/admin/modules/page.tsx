'use client'
import { useEffect, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { createClient } from '@/lib/supabase'
import { MODULES, flagKey, truthy } from '@/lib/modules'
import { ToggleLeft, ToggleRight } from 'lucide-react'

const PHASE_LABEL: Record<number, string> = { 1: 'Fase 1', 2: 'Fase 2', 3: 'Fase 3' }

export default function ModulesPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const keys = MODULES.map(m => flagKey(m.name))
    const { data } = await createClient().from('app_settings').select('key,value').in('key', keys)
    const map = Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
    const next: Record<string, boolean> = {}
    for (const m of MODULES) {
      const stored = map[flagKey(m.name)]
      next[m.name] = stored === undefined || stored === null ? m.defaultEnabled : truthy(stored)
    }
    setEnabled(next)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggle(name: string) {
    setError(null); setBusy(name)
    const value = enabled[name] ? 'false' : 'true'
    try {
      const { error: upErr } = await createClient().from('app_settings')
        .upsert({ key: flagKey(name), value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      if (upErr) throw new Error(upErr.message)
      setEnabled(prev => ({ ...prev, [name]: !prev[name] }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally { setBusy(null) }
  }

  return (
    <AdminGuard>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Módulos</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">Activá o desactivá las capacidades del sistema por inmobiliaria</p>
        </div>
        {error && <div className="mb-4 p-3 rounded-md bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))] text-sm">{error}</div>}
        <div className="card-creatio overflow-hidden">
          {loading ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
          : <ul className="divide-y divide-[hsl(var(--border))]">
              {MODULES.map(m => (
                <li key={m.name} className="flex items-center justify-between px-5 py-4">
                  <div className="pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{m.titleEs}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]">{PHASE_LABEL[m.phase] ?? `Fase ${m.phase}`}</span>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{m.descriptionEs}</p>
                  </div>
                  <button data-testid={`toggle-module-${m.name}`} onClick={() => toggle(m.name)} disabled={busy !== null}
                    className="shrink-0 disabled:opacity-50" title={enabled[m.name] ? 'Desactivar' : 'Activar'}>
                    {enabled[m.name]
                      ? <ToggleRight className="w-9 h-9 text-[hsl(var(--primary))]" />
                      : <ToggleLeft className="w-9 h-9 text-[hsl(var(--muted-foreground))]" />}
                  </button>
                </li>
              ))}
            </ul>}
        </div>
      </div>
    </AdminGuard>
  )
}
