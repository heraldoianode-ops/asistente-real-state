'use client'
import { useState, useRef, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown, LogOut } from 'lucide-react'
import { signOut } from '@/lib/auth'

type HeaderUser = { full_name: string | null; email: string; role: string } | null

interface HeaderProps {
  title: string
  user?: HeaderUser
  onSearch?: (query: string) => void
  searchPlaceholder?: string
}

function initialsOf(user: HeaderUser): string {
  if (!user) return '··'
  const source = user.full_name?.trim() || user.email
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function Header({ title, user, onSearch, searchPlaceholder }: HeaderProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSearch?.(query.trim())
  }

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  return (
    <header className="h-16 shrink-0 flex items-center gap-4 px-7 bg-white border-b border-[hsl(var(--border))]">
      <h1 className="text-lg font-bold text-[hsl(var(--foreground))] whitespace-nowrap">{title}</h1>

      {onSearch && (
        <form onSubmit={handleSubmit} className="flex-1 flex justify-center">
          <div className="relative w-full max-w-[340px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[hsl(var(--muted-foreground))]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder ?? 'Buscar…'}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              name="header-search"
              className="w-full pl-9 pr-3.5 py-2 rounded-[9px] border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent"
            />
          </div>
        </form>
      )}
      {!onSearch && <div className="flex-1" />}

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="flex items-center gap-2.5 cursor-pointer"
          data-testid="btn-user-menu"
        >
          <div
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg,#0070CC,#DF2060)' }}
          >
            {initialsOf(user ?? null)}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-[13px] font-semibold leading-tight">{user?.full_name ?? user?.email ?? '—'}</div>
            <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{user?.role === 'admin' ? 'Administrador/a' : 'Agente'}</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-11 w-44 bg-white rounded-lg border border-[hsl(var(--border))] shadow-lg py-1 z-40">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
            >
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
