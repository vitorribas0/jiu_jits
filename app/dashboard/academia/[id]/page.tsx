'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Shell, LoadingScreen, useSession } from '@/app/components/Shell';
import { ClassImage, type ClassImageRef } from '@/app/components/ClassImage';
import {
  Alert,
  BeltBadge,
  Button,
  Card,
  EmptyState,
} from '@/app/components/ui';

interface Academia {
  id: string;
  name: string;
  address: string;
  checkInRadius: number;
}

interface Turma {
  id: string;
  name: string;
  description?: string;
  days: string[];
  startTime: string;
  endTime: string;
  maxStudents?: number;
  students: string[];
  image?: ClassImageRef | null;
  professor: { name: string; belt: string; degree: number } | null;
}

export default function AcademiaDetalhe() {
  const { user, loading, refresh } = useSession();
  const params = useParams<{ id: string }>();

  const [academia, setAcademia] = useState<Academia | null>(null);
  const [classes, setClasses] = useState<Turma[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ academy: Academia; classes: Turma[] }>(
        `/api/academies/${params.id}/classes`
      );
      setAcademia(data.academy);
      setClasses(data.classes);
    } catch (e) {
      setFeedback({ kind: 'error', text: (e as Error).message });
    }
  }, [params.id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading || !user) return <LoadingScreen />;

  async function toggleEnroll(turma: Turma, matriculado: boolean) {
    setBusyId(turma.id);
    try {
      await api(`/api/classes/${turma.id}/enroll`, {
        method: matriculado ? 'DELETE' : 'POST',
      });
      setFeedback({
        kind: 'success',
        text: matriculado
          ? `Você saiu de ${turma.name}.`
          : `Matriculado em ${turma.name}!`,
      });
      load();
      refresh();
    } catch (e) {
      setFeedback({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Shell user={user}>
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-600 transition hover:text-indigo-600"
      >
        ← Voltar ao painel
      </Link>

      {!academia ? (
        feedback ? (
          <Alert kind="error">{feedback.text}</Alert>
        ) : (
          <LoadingScreen />
        )
      ) : (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-zinc-900">
              🏠 {academia.name}
            </h1>
            <p className="mt-1.5 text-zinc-600">📍 {academia.address}</p>
            <p className="mt-0.5 text-sm text-zinc-500">
              Check-in liberado a até {academia.checkInRadius}m daqui
            </p>
          </div>

          {feedback && (
            <div className="mb-6">
              <Alert kind={feedback.kind}>{feedback.text}</Alert>
            </div>
          )}

          {classes.length === 0 ? (
            <Card>
              <EmptyState
                icon="📅"
                title="Nenhuma turma nesta academia"
                description="Assim que uma turma for criada aqui, ela aparece nesta lista."
              />
            </Card>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {classes.map((c) => {
                const matriculado = c.students.includes(user.id);
                const lotada =
                  !!c.maxStudents && c.students.length >= c.maxStudents;

                return (
                  <li key={c.id}>
                    <Card className="flex h-full flex-col overflow-hidden">
                      <ClassImage
                        classId={c.id}
                        image={c.image}
                        name={c.name}
                        className="h-32 w-full text-4xl"
                      />

                      <div className="flex flex-1 flex-col p-5">
                        <h2 className="font-bold text-zinc-900">{c.name}</h2>
                        <p className="mt-1 text-sm text-zinc-600">
                          🕐 {c.days.join(', ')} · {c.startTime}–{c.endTime}
                        </p>

                        {c.professor && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-sm text-zinc-600">
                              👨‍🏫 {c.professor.name}
                            </span>
                            <BeltBadge
                              belt={c.professor.belt}
                              degree={c.professor.degree}
                              size="sm"
                            />
                          </div>
                        )}

                        {c.description && (
                          <p className="mt-2 text-sm text-zinc-500">
                            {c.description}
                          </p>
                        )}

                        <p className="mt-2 text-xs text-zinc-500">
                          👥 {c.students.length}
                          {c.maxStudents ? ` de ${c.maxStudents}` : ''} matriculado
                          {c.students.length === 1 ? '' : 's'}
                        </p>

                        <div className="mt-4 flex flex-1 items-end gap-2">
                          {user.role === 'aluno' ? (
                            <Button
                              full
                              variant={matriculado ? 'secondary' : 'primary'}
                              onClick={() => toggleEnroll(c, matriculado)}
                              disabled={
                                busyId === c.id || (!matriculado && lotada)
                              }
                            >
                              {matriculado
                                ? 'Sair da turma'
                                : lotada
                                  ? 'Turma lotada'
                                  : 'Entrar na turma'}
                            </Button>
                          ) : (
                            <Link
                              href={`/dashboard/turma/${c.id}`}
                              className="w-full rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-zinc-800 ring-1 ring-inset ring-zinc-300 transition hover:bg-zinc-50"
                            >
                              Ver chamada
                            </Link>
                          )}
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Shell>
  );
}
