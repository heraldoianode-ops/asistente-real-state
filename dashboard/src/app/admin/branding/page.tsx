'use client'
import { useEffect, useState, useRef } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { createClient } from '@/lib/supabase'
import { ImagePlus, Trash2 } from 'lucide-react'

type Kind = 'logo' | 'banner'
const MAX_MB = 5

const CARDS: { kind: Kind; title: string; hint: string; preview: string }[] = [
  { kind: 'logo', title: 'Logo de la empresa', hint: 'PNG/JPG/SVG cuadrado, fondo transparente recomendado', preview: 'h-20 w-20 object-contain' },
  { kind: 'banner', title: 'Banner', hint: 'Imagen apaisada (ej: 1200×300). Se muestra en la pantalla de ingreso', preview: 'h-28 w-full object-cover' },
]

type ColorKey = 'theme_primary' | 'theme_accent'
const COLOR_FIELDS: { key: ColorKey; title: string; hint: string; fallback: string }[] = [
  { key: 'theme_primary', title: 'Color primario', hint: 'Botones, enlaces y barra lateral activa', fallback: '#0070cc' },
  { key: 'theme_accent', title: 'Color de acento', hint: 'Fondos suaves y resaltados', fallback: '#d6ebfb' },
]

export default function BrandingPage() {
  const [urls, setUrls] = useState<Record<Kind, string | null>>({ logo: null, banner: null })
  const [colors, setColors] = useState<Record<ColorKey, string | null>>({ theme_primary: null, theme_accent: null })
  const [busy, setBusy] = useState<Kind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const inputs = { logo: useRef<HTMLInputElement>(null), banner: useRef<HTMLInputElement>(null) }

  async function load() {
    const { data } = await createClient().from('app_settings').select('key,value').in('key', ['logo_url', 'banner_url', 'theme_primary', 'theme_accent'])
    const map = Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
    setUrls({ logo: map.logo_url ?? null, banner: map.banner_url ?? null })
    setColors({ theme_primary: map.theme_primary ?? null, theme_accent: map.theme_accent ?? null })
  }

  async function saveColor(key: ColorKey, value: string) {
    setError(null); setSaved(null)
    setColors(prev => ({ ...prev, [key]: value }))
    const { error: upErr } = await createClient().from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (upErr) { setError(upErr.message); return }
    setSaved('Color actualizado — recargá para verlo aplicado en toda la interfaz')
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
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Marca</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">Logo y banner de la empresa — subí imágenes desde tu PC o teléfono</p>
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

        <div className="card-creatio p-5 mt-4">
          <h2 className="text-sm font-semibold mb-1">Colores de la interfaz</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">Elegí los colores de tu inmobiliaria. Se aplican a toda la interfaz.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {COLOR_FIELDS.map(({ key, title, hint, fallback }) => (
              <div key={key} className="flex items-center gap-3">
                <input type="color" data-testid={`color-${key}`} value={colors[key] ?? fallback}
                  onChange={e => saveColor(key, e.target.value)}
                  className="w-12 h-12 rounded-md border border-[hsl(var(--border))] cursor-pointer bg-transparent p-0.5" />
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>
                  <p className="text-xs font-mono text-[hsl(var(--muted-foreground))]">{colors[key] ?? fallback}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminGuard>
  )
}
