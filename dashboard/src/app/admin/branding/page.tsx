'use client'
import { useEffect, useState, useRef } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { AppShell } from '@/components/AppShell'
import { createClient } from '@/lib/supabase'
import { ImagePlus, Trash2 } from 'lucide-react'

type Kind = 'logo' | 'banner'
const MAX_MB = 5

const CARDS: { kind: Kind; title: string; hint: string; preview: string }[] = [
  { kind: 'logo', title: 'Logo de la empresa', hint: 'PNG/JPG/SVG cuadrado, fondo transparente recomendado', preview: 'h-20 w-20 object-contain' },
  { kind: 'banner', title: 'Banner', hint: 'Imagen apaisada (ej: 1200×300). Se muestra en la pantalla de ingreso', preview: 'h-28 w-full object-cover' },
]

export default function BrandingPage() {
  const [urls, setUrls] = useState<Record<Kind, string | null>>({ logo: null, banner: null })
  const [busy, setBusy] = useState<Kind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const inputs = { logo: useRef<HTMLInputElement>(null), banner: useRef<HTMLInputElement>(null) }

  async function load() {
    const { data } = await createClient().from('app_settings').select('key,value').in('key', ['logo_url', 'banner_url'])
    const map = Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
    setUrls({ logo: map.logo_url ?? null, banner: map.banner_url ?? null })
  }

  useEffect(() => { load() }, [])

  async function handleUpload(kind: Kind, file: File) {
    setError(null); setSaved(null)
    if (!file.type.startsWith('image/')) { setError('El archivo debe ser una imagen.'); return }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`La imagen no puede superar ${MAX_MB} MB.`); return }
    setBusy(kind)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${kind}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('branding').upload(path, file, { cacheControl: '3600', upsert: true })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = supabase.storage.from('branding').getPublicUrl(path)
      const { error: setErr } = await supabase.from('app_settings')
        .update({ value: pub.publicUrl, updated_at: new Date().toISOString() })
        .eq('key', `${kind}_url`)
      if (setErr) throw new Error(setErr.message)
      setSaved(kind === 'logo' ? 'Logo actualizado' : 'Banner actualizado')
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir la imagen')
    } finally { setBusy(null) }
  }

  async function handleRemove(kind: Kind) {
    setError(null); setSaved(null); setBusy(kind)
    try {
      const { error: setErr } = await createClient().from('app_settings')
        .update({ value: null, updated_at: new Date().toISOString() })
        .eq('key', `${kind}_url`)
      if (setErr) throw new Error(setErr.message)
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally { setBusy(null) }
  }

  return (
    <AdminGuard>
      <AppShell title="Marca">
        <div className="mb-6">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Logo y banner de la empresa — subí imágenes desde tu PC o teléfono</p>
        </div>
        {error && <div className="mb-4 p-3 rounded-md bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))] text-sm">{error}</div>}
        {saved && <div className="mb-4 p-3 rounded-md bg-[hsl(var(--accent))] text-sm">{saved}</div>}
        <div className="grid gap-4 lg:grid-cols-2">
          {CARDS.map(({ kind, title, hint, preview }) => (
            <div key={kind} className="card-creatio p-5">
              <h2 className="text-sm font-semibold mb-1">{title}</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">{hint}</p>
              <div className="flex items-center justify-center bg-[hsl(var(--secondary))] border border-dashed border-[hsl(var(--border))] rounded-md mb-4 min-h-[7rem] p-3">
                {urls[kind]
                  ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={urls[kind]!} alt={title} className={`${preview} rounded`} />
                  : <span className="text-xs text-[hsl(var(--muted-foreground))]">Sin imagen</span>}
              </div>
              <input ref={inputs[kind]} type="file" accept="image/*" className="hidden" data-testid={`file-${kind}`}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(kind, f); e.target.value = '' }} />
              <div className="flex items-center gap-2">
                <button onClick={() => inputs[kind].current?.click()} disabled={busy !== null}
                  className="flex items-center gap-2 bg-[hsl(var(--primary))] hover:bg-[hsl(207,100%,35%)] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50">
                  <ImagePlus className="w-4 h-4" />
                  {busy === kind ? 'Subiendo…' : 'Subir imagen'}
                </button>
                {urls[kind] && (
                  <button onClick={() => handleRemove(kind)} disabled={busy !== null}
                    className="flex items-center gap-1.5 px-3 py-2 border border-[hsl(var(--border))] rounded-md text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50">
                    <Trash2 className="w-4 h-4" /> Quitar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </AppShell>
    </AdminGuard>
  )
}
