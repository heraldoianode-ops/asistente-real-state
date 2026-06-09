'use client'
import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/auth'

type AppUser = { id: string; email: string; full_name: string | null; role: string; is_active: boolean }

export function useCurrentUser() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        setUser(u)
      })
      .catch((err: unknown) => {
        console.error('[useCurrentUser] Failed to load user:', err)
        setError('No se pudo cargar el usuario.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return { user, loading, error, isAdmin: user?.role === 'admin' }
}
