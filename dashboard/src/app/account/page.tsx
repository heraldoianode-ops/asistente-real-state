'use client'
import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { createClient } from '@/lib/supabase'
import { KeyRound, Mail, ShieldCheck, CheckCircle2 } from 'lucide-react'

type Mode = 'direct' | 'email'

export default function AccountPage() {
  const router = useRouter()
  const { user, loading } = useCurrentUser()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])
  const [mode, setMode] = useState<Mode>('direct')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleDirectChange(e: FormEvent) {
    e.preventDefault()
    setError(null); setSuccess(null)
    if (newPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (newPassword !== confirmPassword) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    try {
      const { error: err } = await createClient().auth.updateUser({
        password: newPassword,
        data: { password_changed_at: new Date().toISOString() },
      })
      if (err) throw new Error(err.message)
      setNewPassword(''); setConfirmPassword('')
      setSuccess('Contraseña actualizada correctamente.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña')
    } finally { setSaving(false) }
  }

  async function handleEmailConfirmation() {
    if (!user) return
    setError(null); setSuccess(null); setSaving(true)
    try {
      const { error: err } = await createClient().auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) throw new Error(err.message)
      setSuccess(`Enviamos un enlace de confirmación a ${user.email}. Abrilo en este mismo navegador para definir tu nueva contraseña.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar el correo')
    } finally { setSaving(false) }
  }

  const modeButton = (m: Mode, label: string, Icon: typeof KeyRound) => (
    <button type="button" onClick={() => { setMode(m); setError(null); setSuccess(null) }}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
        mode === m
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
          : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
      }`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  )

  return (
    <div className="flex h-screen bg-[hsl(var(--background))]">
      <Sidebar role={user?.role} />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Mi cuenta</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">Seguridad y acceso</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-w-lg space-y-4">
            <div className="card-creatio p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{user?.full_name ?? user?.email}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{user?.email} — {user?.role === 'admin' ? 'Administrador' : 'Agente'}</p>
                </div>
              </div>
            </div>

            <div className="card-creatio p-5">
              <h2 className="text-base font-semibold mb-1">Cambiar contraseña</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                Te recomendamos reemplazar la contraseña asignada por una propia.
                Podés cambiarla ahora o, si lo preferís, con confirmación a tu correo electrónico asignado.
              </p>

              <div className="flex gap-2 mb-4">
                {modeButton('direct', 'Cambiar ahora', KeyRound)}
                {modeButton('email', 'Confirmar por correo', Mail)}
              </div>

              {error && <div className="p-3 mb-4 rounded-md bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))] text-sm">{error}</div>}
              {success && (
                <div className="p-3 mb-4 rounded-md bg-[hsl(var(--status-active-bg))] text-[hsl(var(--status-active-fg))] text-sm flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {success}
                </div>
              )}

              {mode === 'direct' ? (
                <form onSubmit={handleDirectChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Nueva contraseña<span className="text-red-500 ml-0.5">*</span></label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      autoComplete="new-password" minLength={8} required
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent" />
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Mínimo 8 caracteres.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Confirmar nueva contraseña<span className="text-red-500 ml-0.5">*</span></label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      autoComplete="new-password" minLength={8} required
                      className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent" />
                  </div>
                  <button type="submit" disabled={saving} data-testid="btn-change-password"
                    className="w-full px-4 py-2 bg-[hsl(var(--primary))] hover:bg-[hsl(207,100%,35%)] text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50">
                    {saving ? 'Guardando…' : 'Actualizar contraseña'}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Te enviaremos un enlace a <span className="font-medium text-[hsl(var(--foreground))]">{user?.email}</span>.
                    Al abrirlo vas a poder definir tu nueva contraseña de forma segura.
                  </p>
                  <button type="button" onClick={handleEmailConfirmation} disabled={saving} data-testid="btn-send-confirmation"
                    className="w-full px-4 py-2 bg-[hsl(var(--primary))] hover:bg-[hsl(207,100%,35%)] text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50">
                    {saving ? 'Enviando…' : 'Enviar enlace de confirmación'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
