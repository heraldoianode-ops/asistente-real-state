'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldAlert, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const DISMISS_KEY = 'pwd-change-banner-dismissed'
const HIDDEN_PATHS = ['/login', '/reset-password', '/account']

export function PasswordChangeBanner() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (HIDDEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) { setShow(false); return }
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    let cancelled = false
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      // Recommend a change only while the assigned password was never replaced
      if (!user.user_metadata?.password_changed_at) setShow(true)
    })
    return () => { cancelled = true }
  }, [pathname])

  if (!show) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm card-creatio shadow-lg p-4" data-testid="password-change-banner">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[hsl(var(--status-pending-bg))] flex items-center justify-center shrink-0">
          <ShieldAlert className="w-5 h-5 text-[hsl(var(--status-pending-fg))]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Recomendación de seguridad</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Estás usando una contraseña asignada. Te recomendamos cambiarla por una propia,
            con confirmación a tu correo si lo preferís.
          </p>
          <Link href="/account" onClick={() => setShow(false)}
            className="inline-block mt-2 text-xs font-medium text-[hsl(var(--primary))] hover:underline">
            Cambiar contraseña →
          </Link>
        </div>
        <button onClick={dismiss} aria-label="No volver a mostrar"
          className="p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
