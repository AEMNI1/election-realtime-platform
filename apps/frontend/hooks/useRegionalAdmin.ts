'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { MeResponse } from '@/lib/types';

export function useRegionalAdmin() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiFetch<MeResponse>('/api/me').then(value => {
      if (value.user.must_change_password) { router.replace('/change-password'); return; }
      if (value.user.role !== 'REGIONAL_ADMIN') { router.replace('/observer'); return; }
      setMe(value);
    }).catch(() => router.replace('/login')).finally(() => setLoading(false));
  }, [router]);
  return { me, loading };
}
