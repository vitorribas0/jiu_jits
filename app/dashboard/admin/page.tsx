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

const BELTS = ['branca', 'azul', 'roxa', 'marrom', 'preta'] as const;

interface Academy {
  _id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  checkInRadius: number;
}

interface Professor {
  _id: string;
  name: string;
  belt: string;
  degree: number;
}

interface Turma {
  _id: string;
  name: string;
  description?: string;
  days: string[];
  startTime: string;
  endTime: string;
  maxStudents?: number;
  students: string[];
  image?: ClassImageRef | null;
  professor: Professor | null;
  academy: Academy | null;
}

interface Usuario {
  _id: string;
  name: string;
  email: string;
  cpf?: string;
  phone?: string;
  birthDate?: string;
  emergencyContact?: { name: string; phone: string };
  role: 'admin' | 'professor' | 'aluno';
  belt: string;
  degree: number;
}

type Tab = 'academias' | 'turmas' | 'usuarios' | 'fotos';

export default function AdminDashboard() {
  const { user, stats: session, loading } = useSession('admin');
  const [tab, setTab] = useState<Tab>('academias');

  const [academies, setAcademies] = useState<Academy[]>([]);
  const [classes, setClasses] = useState<Turma[]>([]);
  const [users, setUsers] = useState<Usuario[]>([]);
  const [photos, setPhotos] = useState<Foto[]>([]);

  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [a, c, u, p] = await Promise.all([
        api<Academy[]>('/api/academies'),
        api<Turma[]>('/api/classes'),
        api<Usuario[]>('/api/users'),
        api<Foto[]>('/api/photos'),
      ]);
      setAcademies(a);
      setClasses(c);
      setUsers(u);
      setPhotos(p);
    } catch (e) {
      setFeedback({ kind: 'error', text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    if (user) loadAll();
  }, [user, loadAll]);

  if (loading || !user) return <LoadingScreen />;

  const professors = users.filter(
    (u) => u.role === 'professor' || u.role === 'admin'
  );

  const nav: NavItem[] = [
    { id: 'academias', label: 'Academias', icon: '🏠', count: academies.length },
    { id: 'turmas', label: 'Turmas', icon: '📅', count: classes.length },
    { id: 'usuarios', label: 'Usuários', icon: '👥', count: users.length },
    { id: 'fotos', label: 'Fotos', icon: '📸', count: photos.length },
  ];

  return (
    <Shell
      user={user}
      pendingApprovals={session?.pendingApprovals ?? 0}
      nav={nav}
      activeNav={tab}
      onNavigate={(id) => {
        setTab(id as Tab);
        setFeedback(null);
      }}
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Painel do administrador</h1>
        <p className="mt-1 text-zinc-600">
          Cadastre academias, monte as turmas e gerencie os alunos da Gaviões.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <Stat
          label="Alunos"
          value={users.filter((u) => u.role === 'aluno').length}
          icon="🥋"
          accent="purple"
        />
        <Stat
          label="Professores"
          value={users.filter((u) => u.role === 'professor').length}
          icon="👨‍🏫"
          accent="amber"
        />
      </div>

      {feedback && (
        <div className="mb-6">
          <Alert kind={feedback.kind}>{feedback.text}</Alert>
        </div>
      )}

      {tab === 'academias' && (
        <AcademiesTab
          academies={academies}
          onDone={(msg) => {
            setFeedback({ kind: 'success', text: msg });
            loadAll();
          }}
          onError={(text) => setFeedback({ kind: 'error', text })}
        />
      )}

      {tab === 'turmas' && (
        <ClassesTab
          classes={classes}
          academies={academies}
          professors={professors}
          onDone={(msg) => {
            setFeedback({ kind: 'success', text: msg });
            loadAll();
          }}
          onError={(text) => setFeedback({ kind: 'error', text })}
        />
      )}

      {tab === 'fotos' && (
        <PhotoGallery
          photos={photos}
          classes={classes.map((c) => ({ _id: c.id, name: c.name }))}
          canUpload
          canDelete={() => true}
          onChange={loadAll}
        />
      )}

      {tab === 'usuarios' && (
        <UsersTab
          users={users}
          currentUserId={user.id}
          onDone={(msg) => {
            setFeedback({ kind: 'success', text: msg });
            loadAll();
          }}
          onError={(text) => setFeedback({ kind: 'error', text })}
        />
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------ Academias --- */

const EMPTY_ACADEMY = {
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  checkInRadius: '150',
};

type AcademyForm = typeof EMPTY_ACADEMY;

/** Mesmo formulário para cadastrar e para editar uma academia. */
function AcademyFields({
  form,
  setForm,
  onError,
}: {
  form: AcademyForm;
  setForm: (f: AcademyForm) => void;
  onError: (msg: string) => void;
}) {
  const [locating, setLocating] = useState(false);

  async function useMyLocation() {
    setLocating(true);
    try {
      const pos = await getPosition();
      setForm({
        ...form,
        latitude: pos.coords.latitude.toFixed(6),
        longitude: pos.coords.longitude.toFixed(6),
      });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  return (
    <>
      <Field label="Nome">
        <Input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Gaviões — Unidade Centro"
        />
      </Field>

      <Field label="Endereço">
        <Input
          required
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Rua Exemplo, 123 — São Paulo/SP"
        />
      </Field>

      <div className="rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-200">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-800">
            📍 Coordenadas do tatame
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={useMyLocation}
            disabled={locating}
          >
            {locating ? 'Buscando…' : 'Usar minha localização'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude">
            <Input
              required
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              placeholder="-23.550520"
            />
          </Field>
          <Field label="Longitude">
            <Input
              required
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              placeholder="-46.633308"
            />
          </Field>
        </div>
      </div>

      <Field
        label="Raio de check-in (metros)"
        hint="O aluno só consegue bater ponto dentro desta distância."
      >
        <Input
          required
          type="number"
          min={20}
          max={5000}
          value={form.checkInRadius}
          onChange={(e) => setForm({ ...form, checkInRadius: e.target.value })}
        />
      </Field>
    </>
  );
}

function AcademiesTab({
  academies,
  onDone,
  onError,
}: {
  academies: Academy[];
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Academy | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AcademyForm>(EMPTY_ACADEMY);

  function startCreate() {
    setForm(EMPTY_ACADEMY);
    setCreating(true);
  }

  function startEdit(a: Academy) {
    setForm({
      name: a.name,
      address: a.address,
      latitude: String(a.latitude),
      longitude: String(a.longitude),
      checkInRadius: String(a.checkInRadius),
    });
    setEditing(a);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const body = JSON.stringify({
      name: form.name,
      address: form.address,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      checkInRadius: Number(form.checkInRadius),
    });

    try {
      if (editing) {
        await api(`/api/academies/${editing.id}`, { method: 'PATCH', body });
        setEditing(null);
        onDone('Academia atualizada!');
      } else {
        await api('/api/academies', { method: 'POST', body });
        setCreating(false);
        onDone('Academia cadastrada!');
      }
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(a: Academy) {
    if (
      !confirm(
        `Desativar "${a.name}"? As turmas dela deixam de aceitar check-in, mas o histórico é mantido.`
      )
    )
      return;

    try {
      await api(`/api/academies/${a.id}`, { method: 'DELETE' });
      setEditing(null);
      onDone('Academia desativada.');
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Academias"
          icon="🏠"
          subtitle="A localização define onde o check-in é aceito"
          action={<Button onClick={startCreate}>+ Nova academia</Button>}
        />

        {academies.length === 0 ? (
          <EmptyState
            icon="🏠"
            title="Nenhuma academia cadastrada"
            description="Cadastre a primeira academia para poder criar turmas e liberar o check-in dos alunos."
            action={<Button onClick={startCreate}>Cadastrar academia</Button>}
          />
        ) : (
          <ul className="divide-y divide-zinc-200">
            {academies.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-start justify-between gap-4 px-6 py-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/academia/${a.id}`}
                    className="font-semibold text-zinc-900 transition hover:text-indigo-600"
                  >
                    {a.name}
                  </Link>
                  <p className="text-sm text-zinc-600">📍 {a.address}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {a.latitude.toFixed(5)}, {a.longitude.toFixed(5)} · raio de
                    check-in {a.checkInRadius}m
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/dashboard/academia/${a.id}`}
                    className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 ring-1 ring-inset ring-zinc-300 transition hover:bg-zinc-50"
                  >
                    Ver turmas
                  </Link>
                  <Button variant="secondary" onClick={() => startEdit(a)}>
                    Editar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nova academia"
      >
        <form onSubmit={save} className="space-y-4">
          <AcademyFields form={form} setForm={setForm} onError={onError} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" full disabled={saving}>
              {saving ? 'Salvando…' : 'Cadastrar academia'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreating(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Editar ${editing.name}` : ''}
      >
        <form onSubmit={save} className="space-y-4">
          <AcademyFields form={form} setForm={setForm} onError={onError} />

          <div className="flex gap-3 pt-2">
            <Button type="submit" full disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </Button>
          </div>

          <div className="border-t border-zinc-200 pt-4">
            <Button
              type="button"
              variant="danger"
              onClick={() => editing && deactivate(editing)}
            >
              Desativar academia
            </Button>
            <p className="mt-2 text-xs text-zinc-500">
              As turmas param de aceitar check-in. O histórico de presença
              continua guardado.
            </p>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* --------------------------------------------------------------- Turmas --- */

function ClassesTab({
  classes,
  academies,
  professors,
  onDone,
  onError,
}: {
  classes: Turma[];
  academies: Academy[];
  professors: Usuario[];
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Turma | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    academy: '',
    professor: '',
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
          professor: form.professor,
          days: form.days,
          startTime: form.startTime,
          endTime: form.endTime,
          maxStudents: form.maxStudents ? Number(form.maxStudents) : undefined,
        }),
      });
      setOpen(false);
      setForm({
        name: '',
        description: '',
        academy: '',
        professor: '',
        days: [],
        startTime: '19:00',
        endTime: '20:30',
        maxStudents: '',
      });
      onDone('Turma criada!');
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remover a turma "${name}"?`)) return;
    try {
      await api(`/api/classes/${id}`, { method: 'DELETE' });
      onDone('Turma removida.');
    } catch (e) {
      onError((e as Error).message);
    }
  }

  const blocked = academies.length === 0;

  return (
    <>
      <Card>
        <CardHeader
          title="Turmas"
          icon="📅"
          subtitle="Horários fixos que os alunos podem frequentar"
          action={
            <Button onClick={() => setOpen(true)} disabled={blocked}>
              + Nova turma
            </Button>
          }
        />

        {blocked ? (
          <EmptyState
            icon="🏠"
            title="Cadastre uma academia primeiro"
            description="Toda turma precisa estar ligada a uma academia — é dela que vem a localização do check-in."
          />
        ) : classes.length === 0 ? (
          <EmptyState
            icon="📅"
            title="Nenhuma turma criada"
            description="Monte a grade de horários da academia para os alunos se matricularem."
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
                    👨‍🏫 {c.professor?.name ?? '—'} · 🏠{' '}
                    {c.academy?.name ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    👥 {c.students.length} matriculado
                    {c.students.length === 1 ? '' : 's'}
                    {c.maxStudents ? ` de ${c.maxStudents}` : ''}
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
                  <Button variant="ghost" onClick={() => remove(c.id, c.name)}>
                    Remover
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <EditClassModal
        turma={editing}
        onClose={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          onDone('Turma atualizada!');
        }}
        onRefresh={() => onDone('Imagem atualizada!')}
        onError={onError}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Nova turma">
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
              placeholder="Turma com foco em fundamentos e drills"
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

          <Field label="Professor">
            <Select
              required
              value={form.professor}
              onChange={(e) => setForm({ ...form, professor: e.target.value })}
            >
              <option value="">Selecione…</option>
              {professors.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.belt})
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
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------- Usuários --- */

/** ISO do Mongo → `YYYY-MM-DD`, formato que o <input type="date"> espera. */
function toDateInput(iso?: string) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}

function UsersTab({
  users,
  currentUserId,
  onDone,
  onError,
}: {
  users: Usuario[];
  currentUserId: string;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
    birthDate: '',
    emergencyName: '',
    emergencyPhone: '',
    role: 'aluno',
    belt: 'branca',
    degree: 0,
    password: '',
  });

  function startEdit(u: Usuario) {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      cpf: u.cpf ?? '',
      phone: u.phone ?? '',
      birthDate: toDateInput(u.birthDate),
      emergencyName: u.emergencyContact?.name ?? '',
      emergencyPhone: u.emergencyContact?.phone ?? '',
      role: u.role,
      belt: u.belt,
      degree: u.degree,
      password: '',
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;

    setSaving(true);
    try {
      await api(`/api/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          cpf: form.cpf.replace(/\D/g, ''),
          phone: form.phone,
          birthDate: form.birthDate,
          emergencyContact: {
            name: form.emergencyName,
            phone: form.emergencyPhone,
          },
          role: form.role,
          belt: form.belt,
          degree: Number(form.degree),
          // Só vai no corpo quando o admin realmente digitou uma senha nova
          ...(form.password ? { password: form.password } : {}),
        }),
      });
      setEditing(null);
      onDone(`${form.name} atualizado!`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(u: Usuario) {
    if (
      !confirm(
        `Desativar ${u.name}? A pessoa perde o acesso, mas o histórico de presença é mantido.`
      )
    )
      return;

    try {
      await api(`/api/users/${u.id}`, { method: 'DELETE' });
      setEditing(null);
      onDone(`${u.name} foi desativado.`);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Usuários"
          icon="👥"
          subtitle="Atualize o cadastro, promova professores e gradue as faixas"
        />

        <ul className="divide-y divide-zinc-200">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">
                      você
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-zinc-600">{u.email}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <BeltBadge belt={u.belt} degree={u.degree} size="sm" />
                  <span className="text-xs capitalize text-zinc-500">
                    {u.role}
                  </span>
                </div>
              </div>
              <Button variant="secondary" onClick={() => startEdit(u)}>
                Editar
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Editar ${editing.name}` : ''}
      >
        <form onSubmit={save} className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
              Cadastro
            </h3>

            <Field label="Nome completo">
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>

            <Field label="E-mail">
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="CPF">
                <Input
                  required
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Data de nascimento">
              <Input
                type="date"
                required
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </Field>
          </section>

          <section className="space-y-3 rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-200">
            <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
              🚨 Contato de emergência
            </h3>
            <Field label="Nome">
              <Input
                required
                value={form.emergencyName}
                onChange={(e) =>
                  setForm({ ...form, emergencyName: e.target.value })
                }
              />
            </Field>
            <Field label="Telefone">
              <Input
                type="tel"
                required
                value={form.emergencyPhone}
                onChange={(e) =>
                  setForm({ ...form, emergencyPhone: e.target.value })
                }
              />
            </Field>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
              Graduação
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Faixa">
                <Select
                  value={form.belt}
                  onChange={(e) => setForm({ ...form, belt: e.target.value })}
                >
                  {BELTS.map((b) => (
                    <option key={b} value={b} className="capitalize">
                      {b}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Graus">
                <Select
                  value={form.degree}
                  onChange={(e) =>
                    setForm({ ...form, degree: Number(e.target.value) })
                  }
                >
                  {[0, 1, 2, 3, 4].map((d) => (
                    <option key={d} value={d}>
                      {d} {d === 1 ? 'grau' : 'graus'}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-200">
              <p className="mb-2 text-xs font-semibold text-zinc-600">
                Como vai aparecer
              </p>
              <BeltBadge belt={form.belt} degree={form.degree} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
              Acesso
            </h3>

            <Field label="Papel no sistema">
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="aluno">🏃 Aluno</option>
                <option value="professor">🥋 Professor</option>
                <option value="admin">🔑 Administrador</option>
              </Select>
            </Field>

            <Field
              label="Nova senha"
              hint="Deixe em branco para manter a senha atual."
            >
              <Input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
            </Field>
          </section>

          <div className="flex gap-3 border-t border-zinc-200 pt-4">
            <Button type="submit" full disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </Button>
          </div>

          {editing && editing.id !== currentUserId && (
            <div className="border-t border-zinc-200 pt-4">
              <Button
                type="button"
                variant="danger"
                onClick={() => deactivate(editing)}
              >
                Desativar usuário
              </Button>
              <p className="mt-2 text-xs text-zinc-500">
                Remove o acesso. O histórico de presença continua guardado.
              </p>
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
