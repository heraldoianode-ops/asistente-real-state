'use client'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useCurrentUser } from '@/hooks/useCurrentUser'

interface AppShellProps {
  title: string
  onSearch?: (query: string) => void
  searchPlaceholder?: string
  children: React.ReactNode
}

export function AppShell({ title, onSearch, searchPlaceholder, children }: AppShellProps) {
  const { user } = useCurrentUser()

  return (
    <div className="flex h-screen bg-[hsl(var(--background))] overflow-hidden">
      <Sidebar role={user?.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} user={user} onSearch={onSearch} searchPlaceholder={searchPlaceholder} />
        <main className="flex-1 overflow-y-auto p-7">{children}</main>
      </div>
    </div>
  )
}
