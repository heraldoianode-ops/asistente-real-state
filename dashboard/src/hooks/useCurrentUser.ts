'use client'
import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/auth'

type AppUser = { id: string; email: string; full_name: string | null; role: string; is_active: boolean }

export function useCurrentUser() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  return { user, loading, isAdmin: user?.role === 'admin' }
}
