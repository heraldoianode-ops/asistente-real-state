'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, Users, Settings, LogOut } from 'lucide-react'
import { clearToken } from '@/lib/auth'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/crm', label: 'CRM', icon: Users },
  { href: '/admin', label: 'Admin', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = () => {
    clearToken()
    router.replace('/login')
  }

  return (
    <aside className="w-56 border-r bg-card flex flex-col">
      <div className="p-4 font-bold text-lg border-b">ARS</div>
      <nav className="flex-1 p-2 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              pathname === href ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
        >
          <LogOut className="h-4 w-4" />
          Salir
        </button>
      </div>
    </aside>
  )
}
