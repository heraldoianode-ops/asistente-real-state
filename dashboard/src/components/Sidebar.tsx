'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, Users, LogOut, UserCog, Phone, Download, LayoutDashboard, Palette, Blocks } from 'lucide-react'
import { signOut } from '@/lib/auth'
import { useBranding } from '@/hooks/useBranding'

const NAV_ITEMS = [
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/crm', label: 'CRM — Clientes', icon: Users },
  { href: '/admin', label: 'Administración', icon: LayoutDashboard },
]

const ADMIN_ITEMS = [
  { href: '/admin/agents', label: 'Agentes', icon: UserCog },
  { href: '/admin/whatsapp', label: 'WhatsApp', icon: Phone },
  { href: '/admin/branding', label: 'Marca', icon: Palette },
  { href: '/admin/modules', label: 'Módulos', icon: Blocks },
  { href: '/admin/export', label: 'Exportar datos', icon: Download },
]

export function Sidebar({ role }: { role?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { branding } = useBranding()

  const handleLogout = async () => {
    await signOut()
    router.replace('/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const linkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive(href)
        ? 'bg-[hsl(var(--sidebar-active))] text-white'
        : 'text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-white'
    }`

  return (
    <aside className="w-60 flex flex-col min-h-screen shrink-0" style={{ backgroundColor: 'hsl(var(--sidebar-bg))' }}>
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          {branding.logo_url
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={branding.logo_url} alt="Logo" className="w-8 h-8 rounded-md object-contain bg-white shrink-0" />
            : <div className="w-8 h-8 rounded-md bg-[hsl(var(--primary))] flex items-center justify-center shrink-0">
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>}
          <div>
            <p className="text-white text-sm font-semibold leading-tight">PropTech AI</p>
            <p className="text-white/40 text-xs">Asistente Real State</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-white/35 uppercase tracking-widest px-3 mb-2">Principal</p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={linkClass(href)}>
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
        {role === 'admin' && (
          <>
            <p className="text-xs font-semibold text-white/35 uppercase tracking-widest px-3 mt-5 mb-2">Panel admin</p>
            {ADMIN_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={linkClass(href)}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>
      <div className="px-3 py-4 border-t border-white/10">
        <button data-testid="btn-logout" onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-white transition-colors">
          <LogOut className="w-4 h-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
