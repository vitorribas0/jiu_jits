'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Shell, LoadingScreen, useSession } from '@/app/components/Shell';
import { TrainingCalendar } from '@/app/components/TrainingCalendar';
import { ClassImage, type ClassImageRef } from '@/app/components/ClassImage';
import { EditClassModal } from '@/app/components/EditClassModal';
import {
  Alert,
  BeltBadge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Stat,
  beltBarColor,
} from '@/app/components/ui';

interface Aluno {
  _id: string;
  name: string;
  email: string;
  belt: string;
  degree: number;
  checkIns: number;
  lastCheckIn: string | null;
}

interface Turma {
  _id: string;
  name: string;
  description?: string;
  days: string[];
  startTime: string;
  endTime: string;
  maxStudents?: number;
  image?: ClassImageRef | null;
  professor: { name: string; belt: string; degree: number } | null;
  academy: { _id: string; name: string; address: string } | null;
}

/** "hoje", "ontem", "há 3 dias" — mais legível que a data crua numa chamada. */
function sinceLabel(iso: string | null) {
  if (!iso) return 'nunca treinou';

  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86_400_000
  );

  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  if (days < 60) return 'há 1 mês';
  return `há ${Math.floor(days / 30)} meses`;
}

export default function TurmaDetalhe() {
  const { user, stats: session, loading, refresh } = useSession();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [turma, setTurma] = useState<Turma | null>(null);
  const [students, setStudents] = useState<Aluno[]>([]);
  const [stats, setStats] = useState({ monthCheckIns: 0, todayCheckIns: 0, pending: 0 });
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  const agendaUrl = useCallback(
    (month: string) => `/api/classes/${params.id}/agenda?month=${month}`,
    [params.id]
  );

  const load = useCallback(async () => {
    try {
      const detail = await api<{
        turma: Turma;
        students: Aluno[];
        stats: { monthCheckIns: number; todayCheckIns: number; pending: number };
      }>(`/api/classes/${params.id}`);
      setTurma(detail.turma);
      setStudents(detail.students);
      setStats(detail.stats);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [params.id]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'aluno') {
      router.replace('/dashboard');
      return;
    }
    load();
  }, [user, load, router]);

  if (loading || !user) return <LoadingScreen />;

  if (error) {
    return (
      <Shell user={user} pendingApprovals={session?.pendingApprovals ?? 0}>
        <Alert kind="error">{error}</Alert>
        <p className="mt-4">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            ← Voltar ao painel
          </Link>
        </p>
      </Shell>
    );
  }

  if (!turma) return <LoadingScreen />;

  return (
    <Shell user={user} pendingApprovals={session?.pendingApprovals ?? 0}>
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-600 transition hover:text-indigo-600"
      >
        ← Voltar ao painel
      </Link>

      <div className="mb-8 flex flex-wrap items-start gap-5">
        <ClassImage
          classId={turma._id}
          image={turma.image}
          name={turma.name}
          className="h-24 w-24 shrink-0 rounded-xl text-3xl shadow-sm ring-1 ring-zinc-200"
        />

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-zinc-900">{turma.name}</h1>
          <p className="mt-1.5 text-zinc-600">
            🕐 {turma.days.join(', ')} · {turma.startTime}–{turma.endTime}
          </p>
          <p className="mt-0.5 text-zinc-600">
            👨‍🏫 {turma.professor?.name ?? '—'} ·{' '}
            {turma.academy ? (
              <Link
                href={`/dashboard/academia/${turma.academy._id}`}
                className="transition hover:text-indigo-600"
              >
                🏠 {turma.academy.name}
              </Link>
            ) : (
              '🏠 —'
            )}
          </p>
          {turma.description && (
            <p className="mt-3 max-w-2xl text-sm text-zinc-600">
              {turma.description}
            </p>
          )}
        </div>

        <Button variant="secondary" onClick={() => setEditing(true)}>
          Editar turma
        </Button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Matriculados"
          value={
            turma.maxStudents
              ? `${students.length} / ${turma.maxStudents}`
              : students.length
          }
          icon="👥"
        />
        <Stat
          label="Presenças hoje"
          value={stats.todayCheckIns}
          icon="✅"
          accent="emerald"
        />
        <Stat
          label="Presenças no mês"
          value={stats.monthCheckIns}
          icon="🔥"
          accent="amber"
        />
      </div>

      {stats.pending > 0 && (
        <div className="mb-8">
          <Alert kind="info">
            {stats.pending} check-in{stats.pending === 1 ? '' : 's'} desta turma
            aguardando sua confirmação. Escolha o dia no calendário para
            resolver.
          </Alert>
        </div>
      )}

      <div className="mb-8">
        <Card>
          <CardHeader
            title="Chamada"
            icon="🥋"
            subtitle="Na ordem da fila: da faixa mais alta para a mais nova"
          />

          {students.length === 0 ? (
            <EmptyState
              icon="👥"
              title="Nenhum aluno matriculado"
              description="Os alunos entram na turma pelo painel deles, em “Turmas disponíveis”."
            />
          ) : (
            <ul className="divide-y divide-zinc-200">
              {students.map((s) => (
                <li key={s._id} className="flex items-stretch">
                  {/* A cor da faixa desenha a hierarquia ao longo da lista */}
                  <span
                    aria-hidden
                    className={`w-1 shrink-0 ${beltBarColor(s.belt)}`}
                  />
                  <div className="flex flex-1 flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900">{s.name}</p>
                      <p className="truncate text-sm text-zinc-500">{s.email}</p>
                      <div className="mt-1.5">
                        <BeltBadge belt={s.belt} degree={s.degree} size="sm" />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-zinc-900">
                        {s.checkIns}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {s.checkIns === 1 ? 'presença' : 'presenças'}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {sinceLabel(s.lastCheckIn)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <TrainingCalendar
        endpoint={agendaUrl}
        classDays={turma.days}
        canManage
        turma={{ _id: turma._id, name: turma.name }}
        onChanged={() => {
          load();
          refresh();
        }}
      />

      <EditClassModal
        turma={editing ? turma : null}
        onClose={() => setEditing(false)}
        onDone={() => {
          setEditing(false);
          load();
        }}
        onRefresh={load}
        onError={setError}
      />
    </Shell>
  );
}
