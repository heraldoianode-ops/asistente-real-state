'use client'
import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useBranding } from '@/hooks/useBranding'

type Status = 'checking' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { branding } = useBranding()
  const [status, setStatus] = useState<Status>('checking')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let settled = false
    const settle = (s: Status) => { if (!settled) { settled = true; setStatus(s) } }

    // The browser client auto-exchanges the ?code= from the recovery email on init;
    // getSession() resolves after that exchange completes.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) settle('ready')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION')) settle('ready')
    })
    const timer = setTimeout(() => settle('invalid'), 4000)
    return () => { subscription.unsubscribe(); clearTimeout(timer) }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (newPassword !== confirmPassword) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    try {
      const { error: err } = await createClient().auth.updateUser({
        password: newPassword,
        data: { password_changed_at: new Date().toISOString() },
      })
      if (err) throw new Error(err.message)
      router.replace('/analytics')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña')
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--background))' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {branding.logo_url
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={branding.logo_url} alt="Logo" className="inline-block w-14 h-14 rounded-xl object-contain mb-4" />
            : <div className="inline-flex w-14 h-14 rounded-xl bg-[hsl(var(--primary))] items-center justify-center mb-4">
                <KeyRound className="w-7 h-7 text-white" />
              </div>}
          <h1 className="text-xl font-bold">Nueva contraseña</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Definí tu nueva contraseña de acceso</p>
        </div>

        <div className="card-creatio p-6">
          {status === 'checking' && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {status === 'invalid' && (
            <div className="text-sm space-y-3">
              <div className="p-3 rounded-md bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))]">
                El enlace no es válido o expiró. Pedí uno nuevo desde Mi cuenta, y abrilo en el mismo navegador donde lo solicitaste.
              </div>
              <button onClick={() => router.replace('/login')}
                className="w-full px-4 py-2 border border-[hsl(var(--border))] rounded-md text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors">
                Ir al inicio de sesión
              </button>
            </div>
          )}
          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 rounded-md bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))] text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium mb-1.5">Nueva contraseña<span className="text-red-500 ml-0.5">*</span></label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password" minLength={8} required autoFocus
                  className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent" />
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Mínimo 8 caracteres.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Confirmar nueva contraseña<span className="text-red-500 ml-0.5">*</span></label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password" minLength={8} required
                  className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent" />
              </div>
              <button type="submit" disabled={saving} data-testid="btn-reset-password"
                className="w-full px-4 py-2 bg-[hsl(var(--primary))] hover:bg-[hsl(207,100%,35%)] text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar y entrar'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
