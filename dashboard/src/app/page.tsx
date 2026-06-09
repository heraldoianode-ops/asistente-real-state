'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    getSession().then((session) => {
      if (session) router.replace('/analytics')
      else router.replace('/login')
    })
  }, [router])
  return null
}
