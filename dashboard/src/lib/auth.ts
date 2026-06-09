import { createClient } from './supabase'

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

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('id, email, full_name, role, is_active')
    .eq('auth_user_id', user.id)
    .single()
  return data as { id: string; email: string; full_name: string | null; role: string; is_active: boolean } | null
}

export function clearToken() {
  void signOut()
}
