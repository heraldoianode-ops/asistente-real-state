'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export interface Branding { logo_url: string | null; banner_url: string | null }

export function useBranding() {
  const [branding, setBranding] = useState<Branding>({ logo_url: null, banner_url: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient()
      .from('app_settings')
      .select('key,value')
      .in('key', ['logo_url', 'banner_url'])
      .then(({ data }) => {
        const map = Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
        setBranding({ logo_url: map.logo_url ?? null, banner_url: map.banner_url ?? null })
        setLoading(false)
      })
  }, [])

  return { branding, loading }
}
