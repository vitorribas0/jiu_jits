'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { LoadingScreen } from '@/app/components/Shell';

/**
 * Encaminha para o painel do papel do usuário. O papel vem do servidor,
 * então uma promoção feita pelo admin vale no próximo carregamento.
 */
export default function DashboardRouter() {
  const router = useRouter();

  useEffect(() => {
    api<{ user: { role: 'admin' | 'professor' | 'aluno' } }>('/api/me')
      .then(({ user }) => router.replace(`/dashboard/${user.role}`))
      .catch(() => router.replace('/login'));
  }, [router]);

  return <LoadingScreen />;
}
