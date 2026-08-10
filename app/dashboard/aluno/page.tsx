'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, getPosition } from '@/lib/api';
import {
  Shell,
  LoadingScreen,
  useSession,
  type NavItem,
} from '@/app/components/Shell';
import { PhotoGallery, type Foto } from '@/app/components/PhotoGallery';
import { TrainingCalendar } from '@/app/components/TrainingCalendar';
import {
  Alert,
  BeltBadge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Stat,
} from '@/app/components/ui';

interface Turma {
  _id: string;
  name: string;
  description?: string;
  days: string[];
  startTime: string;
  endTime: string;
  maxStudents?: number;
  students: string[];
  professor: { _id: string; name: string; belt: string; degree: number } | null;
  academy: { _id: string; name: string; address: string } | null;
}

interface Registro {
  _id: string;
  checkInTime: string;
  distanceMeters: number;
  status: 'presente' | 'atrasado';
  approval: 'pendente' | 'aprovado' | 'recusado';
  class: { name: string } | null;
}

export default function AlunoDashboard() {
  const { user, stats, loading, refresh } = useSession('aluno');
  const [classes, setClasses] = useState<Turma[]>([]);
  const [history, setHistory] = useState<Registro[]>([]);
  const [photos, setPhotos] = useState<Foto[]>([]);
  const [academies, setAcademies] = useState<{ _id: string; name: string; address: string }[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [section, setSection] = useState('treino');
  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);

  const agendaUrl = useCallback(
    (month: string) => `/api/me/agenda?month=${month}`,
    []
  );

  const load = useCallback(async () => {
    try {
      const [c, h, p, a] = await Promise.all([
        api<Turma[]>('/api/classes'),
        api<Registro[]>('/api/checkin'),
        api<Foto[]>('/api/photos'),
        api<{ _id: string; name: string; address: string }[]>('/api/academies'),
      ]);
      setClasses(c);
      setHistory(h);
      setPhotos(p);
      setAcademies(a);
    } catch (e) {
      setFeedback({ kind: 'error', text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading || !user) return <LoadingScreen />;

  const myClasses = classes.filter((c) => c.students.includes(user.id));
  const otherClasses = classes.filter((c) => !c.students.includes(user.id));

  async function checkIn(turma: Turma) {
    setBusyId(turma.id);
    setFeedback(null);
    try {
      const pos = await getPosition();
      const res = await api<{ message: string }>('/api/checkin', {
        method: 'POST',
        body: JSON.stringify({
          classId: turma.id,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      });
      setFeedback({ kind: 'success', text: res.message });
      load();
      refresh();
    } catch (e) {
      setFeedback({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  async function cancelCheckIn(id: string) {
    if (!confirm('Cancelar seu check-in de hoje?')) return;
    try {
      await api(`/api/checkin/${id}`, { method: 'DELETE' });
      setFeedback({ kind: 'success', text: 'Check-in cancelado.' });
      load();
      refresh();
    } catch (e) {
      setFeedback({ kind: 'error', text: (e as Error).message });
    }
  }

  async function enroll(turma: Turma) {
    setBusyId(turma.id);
    try {
      await api(`/api/classes/${turma.id}/enroll`, { method: 'POST' });
      setFeedback({ kind: 'success', text: `Matriculado em ${turma.name}!` });
      load();
    } catch (e) {
      setFeedback({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  // Troca o botão de check-in pelo aviso, indicando se já foi confirmado
  const todayByClass = new Map(
    history
      .filter(
        (h) =>
          new Date(h.checkInTime).toDateString() === new Date().toDateString()
      )
      .map((h) => [h.class?.name, h])
  );

  const nav: NavItem[] = [
    { id: 'treino', label: 'Treinar', icon: '🥋', count: myClasses.length },
    { id: 'calendario', label: 'Meu calendário', icon: '📅' },
    { id: 'fotos', label: 'Fotos', icon: '📸', count: photos.length },
  ];

  return (
    <Shell
      user={user}
      nav={nav}
      activeNav={section}
      onNavigate={(id) => {
        setSection(id);
        setFeedback(null);
      }}
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">
          Oi, {user.name.split(' ')[0]}! 👋
        </h1>
        <p className="mt-1 text-zinc-600">
          Bate o ponto quando chegar no tatame e acompanhe sua evolução.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="mb-2 text-sm text-zinc-600">Sua graduação</p>
          <BeltBadge belt={user.belt} degree={user.degree} />
        </Card>
        <Stat
          label="Treinos este mês"
          value={stats?.monthCheckIns ?? 0}
          icon="🔥"
          accent="amber"
        />
        <Stat
          label="Total no tatame"
          value={stats?.totalCheckIns ?? 0}
          icon="🏆"
          accent="emerald"
        />
      </div>

      {feedback && (
        <div className="mb-6">
          <Alert kind={feedback.kind}>{feedback.text}</Alert>
        </div>
      )}

      {(stats?.myPending ?? 0) > 0 && (
        <div className="mb-6">
          <Alert kind="info">
            {stats!.myPending} check-in{stats!.myPending === 1 ? '' : 's'} seu
            {stats!.myPending === 1 ? '' : 's'} aguardando a confirmação do
            professor. Ele entra na sua frequência assim que for confirmado.
          </Alert>
        </div>
      )}

      {section === 'treino' && (
      <div className="mb-8">
        <Card>
          <CardHeader
            title="Minhas turmas"
            icon="🥋"
            subtitle="Check-in liberado quando você estiver na academia"
          />

          {myClasses.length === 0 ? (
            <EmptyState
              icon="📅"
              title="Você ainda não está em nenhuma turma"
              description="Escolha uma turma na lista abaixo para começar a treinar e registrar presença."
            />
          ) : (
            <ul className="divide-y divide-zinc-200">
              {myClasses.map((c) => {
                const done = todayByClass.get(c.name);
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900">{c.name}</p>
                      <p className="mt-0.5 text-sm text-zinc-600">
                        🕐 {c.days.join(', ')} · {c.startTime}–{c.endTime}
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-600">
                        👨‍🏫 {c.professor?.name ?? '—'} · 📍{' '}
                        {c.academy?.name ?? '—'}
                      </p>
                    </div>

                    {done?.approval === 'pendente' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                          ⏳ Aguardando o professor confirmar
                        </span>
                        <Button
                          variant="ghost"
                          onClick={() => cancelCheckIn(done.id)}
                          disabled={busyId === c.id}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : done?.approval === 'aprovado' ? (
                      <span className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        ✅ Presença confirmada
                      </span>
                    ) : done?.approval === 'recusado' ? (
                      <span className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-300">
                        Presença recusada
                      </span>
                    ) : (
                      <Button
                        onClick={() => checkIn(c)}
                        disabled={busyId === c.id}
                      >
                        {busyId === c.id ? '📍 Localizando…' : '📍 Fazer check-in'}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      )}

      {section === 'treino' && academies.length > 0 && (
        <div className="mb-8">
          <Card>
            <CardHeader
              title="Academias"
              icon="🏠"
              subtitle="Abra uma academia para ver as turmas dela e entrar"
            />
            <ul className="divide-y divide-zinc-200">
              {academies.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900">{a.name}</p>
                    <p className="truncate text-sm text-zinc-600">
                      📍 {a.address}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/academia/${a.id}`}
                    className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 ring-1 ring-inset ring-zinc-300 transition hover:bg-zinc-50"
                  >
                    Ver turmas
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {section === 'treino' && otherClasses.length > 0 && (
        <div className="mb-8">
          <Card>
            <CardHeader
              title="Turmas disponíveis"
              icon="➕"
              subtitle="Matricule-se para poder bater ponto"
            />
            <ul className="divide-y divide-zinc-200">
              {otherClasses.map((c) => {
                const full =
                  !!c.maxStudents && c.students.length >= c.maxStudents;
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900">{c.name}</p>
                      <p className="mt-0.5 text-sm text-zinc-600">
                        🕐 {c.days.join(', ')} · {c.startTime}–{c.endTime}
                      </p>
                      {c.description && (
                        <p className="mt-0.5 text-sm text-zinc-500">
                          {c.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => enroll(c)}
                      disabled={busyId === c.id || full}
                    >
                      {full ? 'Turma lotada' : 'Matricular'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}

      {section === 'calendario' && (
      <div className="mb-8">
        <TrainingCalendar
          endpoint={agendaUrl}
          personal
          onChanged={() => {
            load();
            refresh();
          }}
        />
      </div>

      )}

      {section === 'fotos' && (
      <div className="mb-8">
        <PhotoGallery
          photos={photos}
          classes={[]}
          canUpload={false}
          canDelete={() => false}
          onChange={load}
        />
      </div>
      )}
    </Shell>
  );
}
