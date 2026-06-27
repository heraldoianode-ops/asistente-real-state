'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { BarChart3, Users, LogOut, UserCog, Phone, Download, LayoutDashboard, Palette, Menu, X } from 'lucide-react'
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
  { href: '/admin/export', label: 'Exportar datos', icon: Download },
]

export function Sidebar({ role }: { role?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { branding } = useBranding()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    router.replace('/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const linkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
      isActive(href)
        ? 'bg-[hsl(var(--sidebar-active))] text-white'
        : 'text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-white'
    }`

  const sidebarContent = (
    <>
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          {branding.logo_url
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={branding.logo_url} alt="Logo" className="w-8 h-8 rounded-md object-contain bg-white shrink-0" />
            : <div className="w-8 h-8 rounded-md bg-[hsl(var(--primary))] flex items-center justify-center shrink-0">
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>}
          <div>
            <p className="text-white text-sm font-semibold leading-tight">VALKIRIA RS</p>
            <p className="text-white/40 text-xs">PropTech AI</p>
          </div>
          <button onClick={() => setOpen(false)} className="ml-auto md:hidden text-white/60 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-white/35 uppercase tracking-widest px-3 mb-2">Principal</p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={linkClass(href)} onClick={() => setOpen(false)}>
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
        {role === 'admin' && (
          <>
            <p className="text-xs font-semibold text-white/35 uppercase tracking-widest px-3 mt-5 mb-2">Panel admin</p>
            {ADMIN_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={linkClass(href)} onClick={() => setOpen(false)}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>
      <div className="px-3 py-4 border-t border-white/10">
        <button data-testid="btn-logout" onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-white transition-colors">
          <LogOut className="w-4 h-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        <button onClick={() => setOpen(true)} className="p-2 -ml-2 rounded-md hover:bg-[hsl(var(--secondary))]">
          <Menu className="w-5 h-5" />
        </button>
        <span className="ml-3 text-sm font-semibold">VALKIRIA RS</span>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)}>
          <aside
            className="w-64 flex flex-col h-full"
            style={{ backgroundColor: 'hsl(var(--sidebar-bg))' }}
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col min-h-screen shrink-0" style={{ backgroundColor: 'hsl(var(--sidebar-bg))' }}>
        {sidebarContent}
      </aside>
    </>
  )
}
