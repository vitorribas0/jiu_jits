'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { BeltBadge } from './ui';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'professor' | 'aluno';
  belt: string;
  degree: number;
}

export interface SessionStats {
  totalCheckIns: number;
  monthCheckIns: number;
  /** Check-ins do próprio aluno esperando o professor confirmar. */
  myPending: number;
  /** Check-ins que este professor/admin precisa confirmar. */
  pendingApprovals: number;
}

/**
 * Busca o usuário no servidor (não no localStorage) para que mudanças de
 * papel e faixa apareçam sem precisar deslogar.
 */
export function useSession(requiredRole?: SessionUser['role']) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    api<{ user: SessionUser; stats: SessionStats }>('/api/me')
      .then(({ user, stats }) => {
        if (cancelled) return;

        if (requiredRole && user.role !== requiredRole) {
          router.replace('/dashboard');
          return;
        }

        setUser(user);
        setStats(stats);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) router.replace('/login');
      });

    return () => {
      cancelled = true;
    };
  }, [requiredRole, router]);

  /**
   * Recarrega apenas os contadores. Necessário depois de aprovar ou cancelar
   * um check-in: sem isso o sino e o aviso de pendências ficariam com o
   * número antigo até a próxima navegação.
   */
  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: SessionUser; stats: SessionStats }>(
        '/api/me'
      );
      setUser(data.user);
      setStats(data.stats);
    } catch {
      // Falhar aqui só deixa o contador defasado; não vale derrubar a tela
    }
  }, []);

  return { user, stats, loading, refresh };
}

const ROLE_LABEL = {
  admin: { text: 'Administrador', icon: '🔑' },
  professor: { text: 'Professor', icon: '🥋' },
  aluno: { text: 'Aluno', icon: '🏃' },
};

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  count?: number;
  /** Destaca a entrada quando há algo esperando ação. */
  alert?: boolean;
}

export function Shell({
  user,
  pendingApprovals = 0,
  nav,
  activeNav,
  onNavigate,
  children,
}: {
  user: SessionUser;
  /** Mostra o aviso de chamadas a confirmar no cabeçalho. */
  pendingApprovals?: number;
  /** Seções do painel. Quando presente, aparece a barra lateral. */
  nav?: NavItem[];
  activeNav?: string;
  onNavigate?: (id: string) => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const role = ROLE_LABEL[user.role];
  const [menuOpen, setMenuOpen] = useState(false);

  function logout() {
    localStorage.clear();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>
              🥋
            </span>
            <div>
              <p className="text-lg font-bold leading-tight text-zinc-900">
                Gaviões
              </p>
              <p className="text-xs text-zinc-500">
                {role.icon} {role.text}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {pendingApprovals > 0 && (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-100"
              >
                <span aria-hidden>🔔</span>
                <span className="hidden sm:inline">
                  {pendingApprovals} a confirmar
                </span>
                <span className="sm:hidden">{pendingApprovals}</span>
              </Link>
            )}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-zinc-900">{user.name}</p>
              <p className="text-xs text-zinc-500">{user.email}</p>
            </div>
            <BeltBadge belt={user.belt} degree={user.degree} size="sm" />
            <button
              onClick={logout}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-red-600"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {nav && nav.length > 0 ? (
        <div className="mx-auto max-w-6xl gap-8 px-6 py-8 lg:grid lg:grid-cols-[13rem_1fr]">
          {/* Em telas estreitas a lista vira uma gaveta, para não empurrar
              o conteúdo para baixo da dobra */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            className="mb-4 flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-sm font-semibold text-zinc-800 shadow-sm ring-1 ring-zinc-200 lg:hidden"
          >
            <span>
              {nav.find((n) => n.id === activeNav)?.icon}{' '}
              {nav.find((n) => n.id === activeNav)?.label ?? 'Seções'}
            </span>
            <span aria-hidden className="text-zinc-400">
              {menuOpen ? '▲' : '▼'}
            </span>
          </button>

          <aside className={`${menuOpen ? 'block' : 'hidden'} mb-6 lg:mb-0 lg:block`}>
            <nav className="space-y-1 lg:sticky lg:top-6">
              {nav.map((item) => {
                const active = item.id === activeNav;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate?.(item.id);
                      setMenuOpen(false);
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-zinc-700 hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-zinc-200'
                    }`}
                  >
                    <span aria-hidden className="text-base">
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.count !== undefined && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          active
                            ? 'bg-white/20 text-white'
                            : item.alert
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-zinc-200 text-zinc-600'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      )}
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-indigo-600" />
        <p className="mt-4 text-sm text-zinc-600">Carregando…</p>
      </div>
    </div>
  );
}
