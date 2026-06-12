// Supabase public config. URL and publishable key are safe to ship in the
// browser bundle — data access is protected by RLS policies, not by these values.
// Env vars (if set in Netlify) take precedence over the committed defaults.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nehfrtedwcmdlmbulhef.supabase.co'

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_PVLt7BxiUrezs3WigUDGJg_Ot-e1zf9'
