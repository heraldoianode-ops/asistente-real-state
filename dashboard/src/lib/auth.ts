'use client';

export interface SessionUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'agent';
  is_active: boolean;
}

export function getTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function isLoggedIn(): boolean {
  return !!getTokenFromCookie();
}

export function clearSession(): void {
  document.cookie = 'access_token=; Max-Age=0; path=/';
}

export async function getSession(): Promise<SessionUser | null> {
  const token = getTokenFromCookie();
  if (!token) return null;
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === 'admin';
}
