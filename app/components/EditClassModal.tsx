'use client';

import { useEffect, useState } from 'react';
import { api, apiUpload } from '@/lib/api';
import { compressImage } from '@/lib/image';
import { ClassImage, type ClassImageRef } from './ClassImage';
import { Button, Field, Input, Modal, Textarea } from './ui';

const DAYS = [
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
  'domingo',
] as const;

export interface TurmaEditavel {
  _id: string;
  name: string;
  description?: string;
  days: string[];
  startTime: string;
  endTime: string;
  maxStudents?: number;
  image?: ClassImageRef | null;
}

/** Edita nome, dias e horário de uma turma. Usado pelo professor e pelo admin. */
export function EditClassModal({
  turma,
  onClose,
  onDone,
  onRefresh,
  onError,
}: {
  turma: TurmaEditavel | null;
  onClose: () => void;
  /** Chamado ao salvar o formulário: os chamadores fecham o modal aqui. */
  onDone: () => void;
  /** Chamado ao trocar a imagem, que não deve fechar o modal. */
  onRefresh?: () => void;
  onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageKey, setImageKey] = useState(0);
  const [image, setImage] = useState<ClassImageRef | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    days: [] as string[],
    startTime: '',
    endTime: '',
    maxStudents: '',
  });

  // Recarrega o formulário sempre que outra turma é aberta
  useEffect(() => {
    if (!turma) return;
    setForm({
      name: turma.name,
      description: turma.description ?? '',
      days: turma.days,
      startTime: turma.startTime,
      endTime: turma.endTime,
      maxStudents: turma.maxStudents ? String(turma.maxStudents) : '',
    });
    setImage(turma.image ?? null);
  }, [turma]);

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
    if (!turma) return;

    if (form.startTime >= form.endTime) {
      onError('O horário de término precisa ser depois do início');
      return;
    }

    setSaving(true);
    try {
      await api(`/api/classes/${turma.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          days: form.days,
          startTime: form.startTime,
          endTime: form.endTime,
          maxStudents: form.maxStudents ? Number(form.maxStudents) : undefined,
        }),
      });
      onDone();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !turma) return;

    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', await compressImage(file));
      const res = await apiUpload<{ image: ClassImageRef }>(
        `/api/classes/${turma.id}/image`,
        body
      );
      setImage(res.image);
      // Muda a `key` para o <ClassImage> buscar de novo: a URL não muda
      setImageKey((k) => k + 1);
      onRefresh?.();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function removeImage() {
    if (!turma || !confirm('Remover a imagem desta turma?')) return;
    try {
      await api(`/api/classes/${turma.id}/image`, { method: 'DELETE' });
      setImage(null);
      setImageKey((k) => k + 1);
      onRefresh?.();
    } catch (err) {
      onError((err as Error).message);
    }
  }

  return (
    <Modal
      open={turma !== null}
      onClose={onClose}
      title={turma ? `Editar ${turma.name}` : ''}
    >
      <form onSubmit={submit} className="space-y-4">
        {turma && (
          <Field label="Imagem da turma" hint="Aparece na lista da academia.">
            <div className="flex items-center gap-4">
              <ClassImage
                key={imageKey}
                classId={turma.id}
                image={image}
                name={turma.name}
                className="h-20 w-20 shrink-0 rounded-lg text-2xl"
              />
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-800 ring-1 ring-inset ring-zinc-300 transition hover:bg-zinc-50">
                  {uploading ? 'Enviando…' : 'Escolher imagem'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={pickImage}
                  />
                </label>
                {image && (
                  <Button type="button" variant="ghost" onClick={removeImage}>
                    Remover imagem
                  </Button>
                )}
              </div>
            </div>
          </Field>
        )}

        <Field label="Nome da turma">
          <Input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>

        <Field label="Descrição (opcional)">
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
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
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
