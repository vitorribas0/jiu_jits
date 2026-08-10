'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Shell,
  LoadingScreen,
  useSession,
  type NavItem,
} from '@/app/components/Shell';
import { PhotoGallery, type Foto } from '@/app/components/PhotoGallery';
import { EditClassModal } from '@/app/components/EditClassModal';
import type { ClassImageRef } from '@/app/components/ClassImage';
import {
  Alert,
  BeltBadge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Stat,
  Textarea,
} from '@/app/components/ui';

const DAYS = [
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
  'domingo',
] as const;

interface Academy {
  id: string;
  name: string;
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
  academy: Academy | null;
}

interface Registro {
  id: string;
  checkInTime: string;
  distanceMeters: number;
  status: 'presente' | 'atrasado';
  student: { _id: string; name: string; belt: string; degree: number } | null;
  class: { _id: string; name: string } | null;
}

export default function ProfessorDashboard() {
  const { user, stats: session, loading } = useSession('professor');
  const [classes, setClasses] = useState<Turma[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [attendance, setAttendance] = useState<Registro[]>([]);
  const [photos, setPhotos] = useState<Foto[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Turma | null>(null);
  const [section, setSection] = useState('turmas');
  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, a, att, p] = await Promise.all([
        api<Turma[]>('/api/classes?mine=true'),
        api<Academy[]>('/api/academies'),
        api<Registro[]>('/api/checkin'),
        api<Foto[]>('/api/photos'),
      ]);
      setClasses(c);
      setAcademies(a);
      setAttendance(att);
      setPhotos(p);
    } catch (e) {
      setFeedback({ kind: 'error', text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading || !user) return <LoadingScreen />;

  const myClassIds = new Set(classes.map((c) => c.id));
  const myAttendance = attendance.filter(
    (a) => a.class && myClassIds.has(a.class.id)
  );

  const today = new Date().toDateString();
  const todayCount = myAttendance.filter(
    (a) => new Date(a.checkInTime).toDateString() === today
  ).length;

  const totalStudents = new Set(classes.flatMap((c) => c.students)).size;

  async function removeClass(id: string, name: string) {
    if (!confirm(`Remover a turma "${name}"?`)) return;
    try {
      await api(`/api/classes/${id}`, { method: 'DELETE' });
      setFeedback({ kind: 'success', text: 'Turma removida.' });
      load();
    } catch (e) {
      setFeedback({ kind: 'error', text: (e as Error).message });
    }
  }

  const nav: NavItem[] = [
    { id: 'turmas', label: 'Minhas turmas', icon: '📅', count: classes.length },
    { id: 'fotos', label: 'Fotos', icon: '📸', count: photos.length },
    {
      id: 'presencas',
      label: 'Presenças',
      icon: '📊',
      count: session?.pendingApprovals ?? 0,
      alert: (session?.pendingApprovals ?? 0) > 0,
    },
  ];

  return (
    <Shell
      user={user}
      pendingApprovals={session?.pendingApprovals ?? 0}
      nav={nav}
      activeNav={section}
      onNavigate={(id) => {
        setSection(id);
        setFeedback(null);
      }}
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">
          Bom treino, professor {user.name.split(' ')[0]}! 🥋
        </h1>
        <p className="mt-1 text-zinc-600">
          Gerencie suas turmas e acompanhe a presença dos alunos.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Minhas turmas" value={classes.length} icon="📅" />
        <Stat
          label="Alunos ativos"
          value={totalStudents}
          icon="👥"
          accent="purple"
        />
        <Stat
          label="Presenças hoje"
          value={todayCount}
          icon="✅"
          accent="emerald"
        />
      </div>

      {feedback && (
        <div className="mb-6">
          <Alert kind={feedback.kind}>{feedback.text}</Alert>
        </div>
      )}

      {section === 'turmas' && (
      <div className="mb-8">
        <Card>
          <CardHeader
            title="Minhas turmas"
            icon="📅"
            subtitle="Turmas que você conduz"
            action={
              <Button onClick={() => setOpen(true)} disabled={academies.length === 0}>
                + Nova turma
              </Button>
            }
          />

          {academies.length === 0 ? (
            <EmptyState
              icon="🏠"
              title="Nenhuma academia cadastrada"
              description="Peça a um administrador para cadastrar a academia antes de criar turmas."
            />
          ) : classes.length === 0 ? (
            <EmptyState
              icon="📅"
              title="Você ainda não tem turmas"
              description="Crie sua primeira turma para os alunos se matricularem e baterem ponto."
              action={<Button onClick={() => setOpen(true)}>Criar turma</Button>}
            />
          ) : (
            <ul className="divide-y divide-zinc-200">
              {classes.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-start justify-between gap-4 px-6 py-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/turma/${c.id}`}
                      className="font-semibold text-zinc-900 transition hover:text-indigo-600"
                    >
                      {c.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-zinc-600">
                      🕐 {c.days.join(', ')} · {c.startTime}–{c.endTime}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-600">
                      🏠 {c.academy?.name ?? '—'} · 👥 {c.students.length} aluno
                      {c.students.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/dashboard/turma/${c.id}`}
                      className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 ring-1 ring-inset ring-zinc-300 transition hover:bg-zinc-50"
                    >
                      Ver chamada
                    </Link>
                    <Button variant="secondary" onClick={() => setEditing(c)}>
                      Editar
                    </Button>
                    <Button variant="ghost" onClick={() => removeClass(c.id, c.name)}>
                      Remover
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      )}

      {section === 'fotos' && (
      <div className="mb-8">
        <PhotoGallery
          photos={photos}
          classes={classes.map((c) => ({ _id: c.id, name: c.name }))}
          canUpload
          canDelete={(p) => p.uploadedBy?.id === user.id}
          onChange={load}
        />
      </div>
      )}

      {section === 'presencas' && (
      <Card>
        <CardHeader
          title="Presenças recentes"
          icon="📊"
          subtitle="Check-ins dos seus alunos"
        />

        {myAttendance.length === 0 ? (
          <EmptyState
            icon="📊"
            title="Nenhuma presença registrada"
            description="Os check-ins dos seus alunos aparecem aqui em tempo real."
          />
        ) : (
          <ul className="divide-y divide-zinc-200">
            {myAttendance.slice(0, 20).map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">
                    {a.student?.name ?? 'Aluno removido'}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {a.class?.name} ·{' '}
                    {new Date(a.checkInTime).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {a.student && (
                    <BeltBadge
                      belt={a.student.belt}
                      degree={a.student.degree}
                      size="sm"
                    />
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      a.status === 'presente'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {a.status === 'presente' ? 'Presente' : 'Atrasado'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      )}

      <EditClassModal
        turma={editing}
        onClose={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          setFeedback({ kind: 'success', text: 'Turma atualizada!' });
          load();
        }}
        onRefresh={load}
        onError={(text) => setFeedback({ kind: 'error', text })}
      />

      <NewClassModal
        open={open}
        academies={academies}
        professorId={user.id}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          setFeedback({ kind: 'success', text: 'Turma criada!' });
          load();
        }}
        onError={(text) => setFeedback({ kind: 'error', text })}
      />
    </Shell>
  );
}

function NewClassModal({
  open,
  academies,
  professorId,
  onClose,
  onDone,
  onError,
}: {
  open: boolean;
  academies: Academy[];
  professorId: string;
  onClose: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    academy: '',
    days: [] as string[],
    startTime: '19:00',
    endTime: '20:30',
    maxStudents: '',
  });

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      days: f.days.includes(day)
        ? f.days.filter((d) => d !== day)
        : [...f.days, day],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/api/classes', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          academy: form.academy,
          professor: professorId,
          days: form.days,
          startTime: form.startTime,
          endTime: form.endTime,
          maxStudents: form.maxStudents ? Number(form.maxStudents) : undefined,
        }),
      });
      setForm({
        name: '',
        description: '',
        academy: '',
        days: [],
        startTime: '19:00',
        endTime: '20:30',
        maxStudents: '',
      });
      onDone();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova turma">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome da turma">
          <Input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Adulto — Gi"
          />
        </Field>

        <Field label="Descrição (opcional)">
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Fundamentos, drills e sparring"
          />
        </Field>

        <Field label="Academia">
          <Select
            required
            value={form.academy}
            onChange={(e) => setForm({ ...form, academy: e.target.value })}
          >
            <option value="">Selecione…</option>
            {academies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Dias da semana">
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize transition ${
                  form.days.includes(d)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Início">
            <Input
              required
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </Field>
          <Field label="Término">
            <Input
              required
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Vagas (opcional)">
          <Input
            type="number"
            min={1}
            value={form.maxStudents}
            onChange={(e) => setForm({ ...form, maxStudents: e.target.value })}
            placeholder="Sem limite"
          />
        </Field>

        <div className="flex gap-3 pt-2">
          <Button type="submit" full disabled={saving || form.days.length === 0}>
            {saving ? 'Criando…' : 'Criar turma'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
