'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, isAdmin, type SessionUser } from '@/lib/auth';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    getSession().then((s) => {
      if (!s || !isAdmin(s)) {
        router.replace('/login');
      } else {
        setUser(s);
        setReady(true);
      }
    });
  }, [router]);

  if (!ready) return <div className="p-8 text-center">Loading…</div>;
  return <>{children}</>;
}
