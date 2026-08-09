'use client';

import { useEffect, useState } from 'react';
import { api, apiUpload, fetchImageUrl } from '@/lib/api';
import { compressImage } from '@/lib/image';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from './ui';

export interface Foto {
  _id: string;
  caption?: string;
  takenAt: string;
  url?: string;
  storage: 'cloudinary' | 'db';
  uploadedBy: { _id: string; name: string } | null;
  class: { _id: string; name: string } | null;
}

interface TurmaRef {
  _id: string;
  name: string;
}

/**
 * Fotos no Cloudinary têm URL pública. As guardadas no Mongo exigem o token,
 * e `<img src>` não manda cabeçalho — então buscamos os bytes e usamos um
 * object URL, liberado quando o componente sai da tela.
 */
export function AuthImage({
  photo,
  className,
}: {
  photo: Foto;
  className?: string;
}) {
  const [src, setSrc] = useState(photo.url ?? '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (photo.url) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    fetchImageUrl(`/api/photos/${photo._id}/file`)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo._id, photo.url]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-100 text-zinc-400 ${className}`}
      >
        <span className="text-sm">Falhou ao carregar</span>
      </div>
    );
  }

  if (!src) {
    return <div className={`animate-pulse bg-zinc-200 ${className}`} />;
  }

  return (
    <img
      src={src}
      alt={photo.caption || `Treino de ${photo.class?.name ?? 'turma'}`}
      loading="lazy"
      className={className}
    />
  );
}

export function PhotoGallery({
  photos,
  classes,
  canUpload,
  canDelete,
  onChange,
}: {
  photos: Foto[];
  classes: TurmaRef[];
  canUpload: boolean;
  /** Recebe a foto e decide se o usuário atual pode removê-la. */
  canDelete: (photo: Foto) => boolean;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Foto | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);

  async function remove(photo: Foto) {
    if (!confirm('Remover esta foto?')) return;
    try {
      await api(`/api/photos/${photo._id}`, { method: 'DELETE' });
      setViewing(null);
      setFeedback({ kind: 'success', text: 'Foto removida.' });
      onChange();
    } catch (e) {
      setFeedback({ kind: 'error', text: (e as Error).message });
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Fotos do treino"
          icon="📸"
          subtitle="Os momentos da academia no tatame"
          action={
            canUpload ? (
              <Button onClick={() => setOpen(true)} disabled={classes.length === 0}>
                + Enviar fotos
              </Button>
            ) : undefined
          }
        />

        {feedback && (
          <div className="px-6 pt-4">
            <Alert kind={feedback.kind}>{feedback.text}</Alert>
          </div>
        )}

        {photos.length === 0 ? (
          <EmptyState
            icon="📸"
            title="Nenhuma foto ainda"
            description={
              canUpload
                ? 'Envie as fotos do treino para os alunos verem depois.'
                : 'Quando o professor publicar fotos dos treinos, elas aparecem aqui.'
            }
            action={
              canUpload && classes.length > 0 ? (
                <Button onClick={() => setOpen(true)}>Enviar fotos</Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <li key={p._id}>
                <button
                  onClick={() => setViewing(p)}
                  className="group block w-full overflow-hidden rounded-lg ring-1 ring-zinc-200 transition hover:ring-2 hover:ring-indigo-500"
                >
                  <AuthImage
                    photo={p}
                    className="aspect-square w-full object-cover transition group-hover:scale-105"
                  />
                </button>
                <p className="mt-1.5 truncate text-xs text-zinc-500">
                  {p.class?.name} ·{' '}
                  {new Date(p.takenAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Lightbox */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm"
            onClick={() => setViewing(null)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-zinc-900">
                  {viewing.class?.name}
                </p>
                <p className="text-sm text-zinc-500">
                  {new Date(viewing.takenAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                  {viewing.uploadedBy && ` · por ${viewing.uploadedBy.name}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {canDelete(viewing) && (
                  <Button variant="ghost" onClick={() => remove(viewing)}>
                    Remover
                  </Button>
                )}
                <button
                  onClick={() => setViewing(null)}
                  aria-label="Fechar"
                  className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-900">
              <AuthImage
                photo={viewing}
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />
            </div>

            {viewing.caption && (
              <p className="border-t border-zinc-200 px-5 py-3 text-sm text-zinc-700">
                {viewing.caption}
              </p>
            )}
          </div>
        </div>
      )}

      <UploadModal
        open={open}
        classes={classes}
        onClose={() => setOpen(false)}
        onDone={(count) => {
          setOpen(false);
          setFeedback({
            kind: 'success',
            text: `${count} foto${count === 1 ? '' : 's'} enviada${count === 1 ? '' : 's'}!`,
          });
          onChange();
        }}
        onError={(text) => setFeedback({ kind: 'error', text })}
      />
    </>
  );
}

export function UploadModal({
  open,
  classes,
  presetClassId,
  presetDate,
  onClose,
  onDone,
  onError,
}: {
  open: boolean;
  classes: TurmaRef[];
  /** Fixa a turma: usado ao enviar a foto de dentro da própria turma. */
  presetClassId?: string;
  /** Fixa o dia: usado ao enviar a foto a partir do calendário. */
  presetDate?: string;
  onClose: () => void;
  onDone: (count: number) => void;
  onError: (msg: string) => void;
}) {
  const [classId, setClassId] = useState(presetClassId ?? '');
  const [caption, setCaption] = useState('');
  const [takenAt, setTakenAt] = useState(
    () => presetDate ?? new Date().toISOString().slice(0, 10)
  );

  // O calendário reaproveita o mesmo modal ao trocar de dia
  useEffect(() => {
    if (presetDate) setTakenAt(presetDate);
  }, [presetDate]);
  useEffect(() => {
    if (presetClassId) setClassId(presetClassId);
  }, [presetClassId]);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;

    setProgress({ done: 0, total: files.length });
    let sent = 0;

    try {
      for (const file of files) {
        const compressed = await compressImage(file);

        const body = new FormData();
        body.append('file', compressed);
        body.append('classId', classId);
        body.append('takenAt', takenAt);
        if (caption) body.append('caption', caption);

        await apiUpload('/api/photos', body);
        sent += 1;
        setProgress({ done: sent, total: files.length });
      }

      setFiles([]);
      setCaption('');
      onDone(sent);
    } catch (e) {
      // Mantém as fotos que já subiram; avisa sobre a que falhou
      onError(
        sent > 0
          ? `${sent} foto(s) enviada(s), mas houve um erro: ${(e as Error).message}`
          : (e as Error).message
      );
    } finally {
      setProgress(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Enviar fotos do treino">
      <form onSubmit={submit} className="space-y-4">
        {presetClassId && presetDate ? (
          <div className="rounded-lg bg-zinc-50 p-4 text-sm ring-1 ring-zinc-200">
            <p className="font-semibold text-zinc-800">
              {classes.find((c) => c._id === presetClassId)?.name ?? 'Turma'}
            </p>
            <p className="mt-0.5 text-zinc-600">
              Treino de{' '}
              {new Date(`${presetDate}T12:00:00`).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
              })}
            </p>
          </div>
        ) : (
          <>
            <Field label="Turma">
              <Select
                required
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Dia do treino">
              <Input
                type="date"
                required
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
              />
            </Field>
          </>
        )}

        <Field
          label="Fotos"
          hint="Pode escolher várias. São reduzidas automaticamente antes do envio."
        >
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            required
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-indigo-700"
          />
        </Field>

        {files.length > 0 && (
          <p className="text-sm text-zinc-600">
            {files.length} arquivo{files.length === 1 ? '' : 's'} selecionado
            {files.length === 1 ? '' : 's'}
          </p>
        )}

        <Field label="Legenda (opcional)">
          <Textarea
            rows={2}
            maxLength={280}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Treino de guarda fechada"
          />
        </Field>

        {progress && (
          <Alert kind="info">
            Enviando {progress.done} de {progress.total}…
          </Alert>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" full disabled={progress !== null || files.length === 0}>
            {progress ? 'Enviando…' : 'Enviar fotos'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={progress !== null}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
