import { getSession } from './auth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function getToken(): Promise<string | null> {
  try {
    const session = await getSession()
    return session?.access_token ?? null
  } catch {
    return null
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken()
  const existingHeaders = options.headers instanceof Headers
    ? Object.fromEntries(options.headers.entries())
    : (options.headers as Record<string, string> | undefined) ?? {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...existingHeaders,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(detail?.detail ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}
