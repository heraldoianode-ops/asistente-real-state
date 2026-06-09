'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default function Home() {
  const router = useRouter()
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true
    getSession()
      .then((session) => {
        router.replace(session ? '/analytics' : '/login')
      })
      .catch(() => {
        router.replace('/login')
      })
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))]">
      <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
