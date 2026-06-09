import { createClient } from './supabase'

type AppUser = { id: string; email: string; full_name: string | null; role: string; is_active: boolean }

function isAppUser(data: unknown): data is AppUser {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    typeof d.id === 'string' &&
    typeof d.email === 'string' &&
    (d.full_name === null || typeof d.full_name === 'string') &&
    typeof d.role === 'string' &&
    typeof d.is_active === 'boolean'
  )
}

export async function signIn(email: string, password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}

export async function getSession() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, is_active')
    .eq('auth_user_id', user.id)
    .single()
  if (error) throw new Error(error.message)
  if (!isAppUser(data)) throw new Error('Unexpected user data shape from database')
  return data
}

export function clearToken() {
  void signOut()
}
