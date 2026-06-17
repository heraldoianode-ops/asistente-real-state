'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { hexToHslTriplet } from '@/lib/color'

// ES: Aplica en runtime los colores elegidos por el admin (tabla app_settings) sobre
//     las CSS variables del :root. Si no hay color guardado, quedan los defaults de globals.css.
// EN: Applies admin-selected colors (app_settings) onto :root CSS variables at runtime.
//     Falls back to globals.css defaults when unset.
const THEME_MAP: Record<string, string[]> = {
  theme_primary: ['--primary', '--ring', '--sidebar-active'],
  theme_accent: ['--accent'],
}

export const THEME_KEYS = Object.keys(THEME_MAP)

export function ThemeVars() {
  useEffect(() => {
    createClient()
      .from('app_settings')
      .select('key,value')
      .in('key', THEME_KEYS)
      .then(({ data }) => {
        const root = document.documentElement
        for (const row of data ?? []) {
          const triplet = hexToHslTriplet(String(row.value ?? ''))
          if (!triplet) continue
          for (const cssVar of THEME_MAP[row.key] ?? []) root.style.setProperty(cssVar, triplet)
        }
      })
  }, [])
  return null
}
