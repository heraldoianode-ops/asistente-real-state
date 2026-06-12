'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { signIn } from '@/lib/auth'
import { useBranding } from '@/hooks/useBranding'

export default function LoginPage() {
  const router = useRouter()
  const { branding } = useBranding()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      router.replace('/analytics')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--background))' }}>
      <div className="w-full max-w-sm">
        {branding.banner_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={branding.banner_url} alt="Banner" className="w-full h-28 object-cover rounded-xl mb-6 shadow-sm" />
        )}
        <div className="text-center mb-8">
          {branding.logo_url
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={branding.logo_url} alt="Logo" className="inline-block w-14 h-14 rounded-xl object-contain mb-4" />
            : <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[hsl(var(--primary))] mb-4">
                <Building2 className="w-6 h-6 text-white" />
              </div>}
          <h1 className="text-2xl font-bold">PropTech AI</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Asistente Real State</p>
        </div>
        <div className="card-creatio p-8">
          <h2 className="text-lg font-semibold mb-6">Iniciar sesión</h2>
          {error && (
            <div className="mb-4 p-3 rounded-md bg-[hsl(var(--status-inactive-bg))] text-[hsl(var(--status-inactive-fg))] text-sm">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Correo electrónico</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Contraseña</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(207,100%,35%)] text-white font-semibold py-2.5 rounded-md text-sm transition disabled:opacity-50 mt-2">
              {loading ? 'Iniciando sesión…' : 'Entrar'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-[hsl(var(--muted-foreground))] mt-6">© {new Date().getFullYear()} M H Systems</p>
      </div>
    </main>
  )
}
