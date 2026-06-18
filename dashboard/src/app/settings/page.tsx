'use client'
import { useCallback, useEffect, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { SUPABASE_URL } from '@/lib/supabase-config'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Calendar, CheckCircle2 } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useCurrentUser()
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await createClient()
      .from('agent_google_credentials')
      .select('google_email')
      .eq('agent_id', user.id)
      .limit(1)
    setConnectedEmail(data && data.length ? (data[0].google_email ?? 'cuenta conectada') : null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('calendar')
    if (p === 'connected') setMsg('✅ Google Calendar conectado correctamente.')
    else if (p === 'error') setMsg('No se pudo conectar Google Calendar. Probá de nuevo.')
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  async function connect() {
    setBusy(true); setMsg(null)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) throw new Error('Sesión no encontrada, volvé a ingresar.')
      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth-start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data?.error ?? 'No se pudo iniciar la conexión')
      window.location.href = data.url
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error')
      setBusy(false)
    }
  }

  async function disconnect() {
    if (!user) return
    setBusy(true); setMsg(null)
    try {
      const { error } = await createClient().from('agent_google_credentials').delete().eq('agent_id', user.id)
      if (error) throw new Error(error.message)
      setConnectedEmail(null)
      setMsg('Google Calendar desconectado.')
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen bg-[hsl(var(--background))]">
      <Sidebar role={user?.role} />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Ajustes</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">Integraciones de tu cuenta</p>
        </div>
        {msg && <div className="mb-4 p-3 rounded-md bg-[hsl(var(--accent))] text-sm">{msg}</div>}
        <div className="card-creatio p-5 max-w-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-[hsl(var(--accent))] flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-[hsl(var(--primary))]" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold">Google Calendar</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Conectá tu cuenta para que las visitas agendadas se creen automáticamente en tu calendario.
              </p>
              {loading ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">Cargando estado…</p>
              ) : connectedEmail ? (
                <div className="mt-3">
                  <p className="text-sm inline-flex items-center gap-1.5 text-[hsl(var(--status-active-fg))]">
                    <CheckCircle2 className="w-4 h-4" /> Conectado{connectedEmail !== 'cuenta conectada' ? `: ${connectedEmail}` : ''}
                  </p>
                  <button onClick={disconnect} disabled={busy}
                    className="mt-3 px-4 py-2 border border-[hsl(var(--border))] rounded-md text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50">
                    {busy ? '…' : 'Desconectar'}
                  </button>
                </div>
              ) : (
                <button data-testid="btn-connect-calendar" onClick={connect} disabled={busy}
                  className="mt-3 flex items-center gap-2 bg-[hsl(var(--primary))] hover:opacity-90 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50">
                  <Calendar className="w-4 h-4" /> {busy ? 'Redirigiendo…' : 'Conectar Google Calendar'}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
