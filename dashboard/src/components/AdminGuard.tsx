'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.replace('/login')
  }, [user, loading, router])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!user || user.role !== 'admin') return null
  return <>{children}</>
}
