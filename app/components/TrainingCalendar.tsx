'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { AuthImage, UploadModal, type Foto } from './PhotoGallery';
import { Alert, BeltBadge, Button, Card, CardHeader } from './ui';

interface Registro {
  _id: string;
  checkInTime: string;
  distanceMeters: number;
  status: 'presente' | 'atrasado';
  approval: 'pendente' | 'aprovado' | 'recusado';
  /** Presente na visão da turma: quem bateu ponto. */
  student?: { _id: string; name: string; belt: string; degree: number } | null;
  /** Presente na visão do aluno: em qual turma ele treinou. */
  class?: { name: string; startTime: string } | null;
}

/** `getDay()` devolve 0 para domingo; o modelo guarda o nome do dia. */
const DAY_NAMES = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
];

const WEEKDAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Chave AAAA-MM-DD no fuso de quem está olhando. */
function dayKey(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function TrainingCalendar({
  endpoint,
  classDays,
  personal = false,
  canManage = false,
  turma,
  onChanged,
}: {
  /** Monta a URL da agenda para o mês pedido (AAAA-MM). */
  endpoint: (month: string) => string;
  /** Dias de treino a destacar. No modo pessoal vem da própria resposta. */
  classDays?: string[];
  /** Visão do aluno: mostra "você treinou" no lugar da chamada da turma. */
  personal?: boolean;
  /** Professor/admin da turma: libera confirmar presença e enviar foto. */
  canManage?: boolean;
  /** Turma a que o calendário pertence, necessária para enviar a foto. */
  turma?: { _id: string; name: string };
  /** Avisa a página para recarregar contadores após aprovar ou enviar foto. */
  onChanged?: () => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selected, setSelected] = useState<string>(() => dayKey(today));
  const [checkIns, setCheckIns] = useState<Registro[]>([]);
  const [photos, setPhotos] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState<Foto | null>(null);
  const [fetchedDays, setFetchedDays] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{
        checkIns: Registro[];
        photos: Foto[];
        trainingDays?: string[];
      }>(endpoint(month));
      setCheckIns(data.checkIns);
      setPhotos(data.photos);
      if (data.trainingDays) setFetchedDays(data.trainingDays);
    } catch (e) {
      // Erro fica contido no calendário: a chamada acima continua na tela
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, month]);

  useEffect(() => {
    load();
  }, [load]);

  // Agrupa por dia local — o servidor manda o horário cru de propósito
  const byDay = useMemo(() => {
    const map = new Map<string, { checkIns: Registro[]; photos: Foto[] }>();
    const bucket = (k: string) => {
      if (!map.has(k)) map.set(k, { checkIns: [], photos: [] });
      return map.get(k)!;
    };

    for (const c of checkIns) bucket(dayKey(new Date(c.checkInTime))).checkIns.push(c);
    for (const p of photos) bucket(dayKey(new Date(p.takenAt))).photos.push(p);

    return map;
  }, [checkIns, photos]);

  // Semanas completas: começa no domingo anterior ao dia 1
  const weeks = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay());

    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }

    // Corta a última semana se ela for inteira do mês seguinte
    const trimmed =
      cells[35].getMonth() === cursor.getMonth() ? cells : cells.slice(0, 35);

    return Array.from({ length: trimmed.length / 7 }, (_, i) =>
      trimmed.slice(i * 7, i * 7 + 7)
    );
  }, [cursor]);

  const highlightDays = classDays ?? fetchedDays;

  const selectedData = byDay.get(selected);
  const selectedDate = new Date(`${selected}T12:00:00`);

  function shiftMonth(delta: number) {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  }

  /**
   * As bordas da grade mostram dias do mês vizinho. Clicar num deles muda o
   * mês junto — só o mês carregado tem dados, e sem isso o dia apareceria
   * vazio mesmo tendo treino registrado.
   */
  function selectDay(d: Date) {
    setSelected(dayKey(d));
    if (d.getMonth() !== cursor.getMonth()) {
      setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }

  const pendingToday =
    selectedData?.checkIns.filter((c) => c.approval === 'pendente') ?? [];

  async function decide(ids: string[], approval: 'aprovado' | 'recusado') {
    setBusy(true);
    try {
      await api('/api/checkin/approve', {
        method: 'PATCH',
        body: JSON.stringify({ ids, approval }),
      });
      await load();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (!confirm('Cancelar este check-in? O registro é apagado.')) return;

    setBusy(true);
    try {
      await api(`/api/checkin/${id}`, { method: 'DELETE' });
      await load();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const monthLabel = cursor.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
      <Card>
        <CardHeader
          title="Calendário da turma"
          icon="📅"
          subtitle="Escolha um dia para ver quem treinou e as fotos"
          action={
            <div className="flex items-center gap-1">
              <button
                onClick={() => shiftMonth(-1)}
                aria-label="Mês anterior"
                className="rounded-lg px-3 py-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
              >
                ←
              </button>
              <span className="min-w-[9rem] text-center text-sm font-semibold capitalize text-zinc-900">
                {monthLabel}
              </span>
              <button
                onClick={() => shiftMonth(1)}
                aria-label="Próximo mês"
                className="rounded-lg px-3 py-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
              >
                →
              </button>
            </div>
          }
        />

        <div className="p-4 sm:p-6">
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((w) => (
              <div
                key={w}
                className="py-1 text-center text-xs font-semibold uppercase text-zinc-400"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((d) => {
              const key = dayKey(d);
              const data = byDay.get(key);
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = key === dayKey(today);
              const isSelected = key === selected;
              // Dia em que a turma treina: mostra o ritmo da semana
              const isTrainingDay = highlightDays.includes(DAY_NAMES[d.getDay()]);

              return (
                <button
                  key={key}
                  onClick={() => selectDay(d)}
                  aria-label={`${d.getDate()} — ${data?.checkIns.length ?? 0} presenças`}
                  aria-current={isSelected ? 'date' : undefined}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition
                    ${isSelected ? 'bg-indigo-600 text-white' : ''}
                    ${!isSelected && isTrainingDay && inMonth ? 'bg-indigo-50/70 hover:bg-indigo-100' : ''}
                    ${!isSelected && (!isTrainingDay || !inMonth) ? 'hover:bg-zinc-100' : ''}
                    ${!inMonth ? 'text-zinc-300' : isSelected ? '' : 'text-zinc-800'}
                    ${isToday && !isSelected ? 'ring-2 ring-inset ring-indigo-400' : ''}`}
                >
                  <span className={isToday ? 'font-bold' : 'font-medium'}>
                    {d.getDate()}
                  </span>

                  <span className="mt-0.5 flex h-3 items-center gap-1">
                    {data && data.checkIns.length > 0 && (
                      <span
                        className={`text-[10px] font-bold leading-none ${
                          isSelected ? 'text-white' : 'text-emerald-600'
                        }`}
                      >
                        {/* No modo pessoal a contagem seria sempre 1: um "✓"
                            responde melhor a "treinei nesse dia?" */}
                        {personal ? '✓' : data.checkIns.length}
                      </span>
                    )}
                    {data && data.photos.length > 0 && (
                      <span
                        aria-hidden
                        title="tem foto"
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-amber-500'
                        }`}
                      />
                    )}
                    {!personal &&
                      data?.checkIns.some((c) => c.approval === 'pendente') && (
                        <span
                          aria-hidden
                          title="aguardando confirmação"
                          className={`h-1.5 w-1.5 rounded-full ring-1 ${
                            isSelected
                              ? 'bg-transparent ring-white'
                              : 'bg-transparent ring-rose-500'
                          }`}
                        />
                      )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-indigo-50 ring-1 ring-indigo-200" />
              dia de treino
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-bold text-emerald-600">
                {personal ? '✓' : '3'}
              </span>
              {personal ? 'você treinou' : 'presenças'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              tem foto
            </span>
            {loading && <span>carregando…</span>}
          </div>

          {error && (
            <div className="mt-4">
              <Alert kind="error">{error}</Alert>
            </div>
          )}
        </div>
      </Card>

      <div className="lg:sticky lg:top-6">
        <Card>
          <CardHeader
            title={selectedDate.toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
            })}
            icon="🥋"
            subtitle={
              selectedData
                ? personal
                  ? `Você treinou · ${selectedData.photos.length} foto${selectedData.photos.length === 1 ? '' : 's'}`
                  : `${selectedData.checkIns.length} presença${selectedData.checkIns.length === 1 ? '' : 's'} · ${selectedData.photos.length} foto${selectedData.photos.length === 1 ? '' : 's'}`
                : personal
                  ? 'Você não treinou neste dia'
                  : 'Nada registrado neste dia'
            }
          />

          {!selectedData ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-zinc-500">
                {personal
                  ? 'Nenhum treino seu e nenhuma foto neste dia.'
                  : 'Ninguém bateu ponto e nenhuma foto foi enviada neste dia.'}
              </p>
              {canManage && turma && (
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setUploading(true)}
                  >
                    📸 Enviar foto do dia
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 p-6">
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  {pendingToday.length > 0 && (
                    <Button
                      onClick={() =>
                        decide(pendingToday.map((c) => c.id), 'aprovado')
                      }
                      disabled={busy}
                    >
                      ✓ Confirmar {pendingToday.length} presença
                      {pendingToday.length === 1 ? '' : 's'}
                    </Button>
                  )}
                  {turma && (
                    <Button
                      variant="secondary"
                      onClick={() => setUploading(true)}
                    >
                      📸 Enviar foto do dia
                    </Button>
                  )}
                </div>
              )}

              {selectedData.photos.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">
                    Fotos do dia
                  </h3>
                  <ul className="grid grid-cols-3 gap-2">
                    {selectedData.photos.map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => setZoom(p)}
                          className="block w-full overflow-hidden rounded-lg ring-1 ring-zinc-200 transition hover:ring-2 hover:ring-indigo-500"
                        >
                          <AuthImage
                            photo={p}
                            className="aspect-square w-full object-cover"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedData.checkIns.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">
                    {personal ? 'Seu treino' : 'Quem treinou'}
                  </h3>
                  <ul className="divide-y divide-zinc-200 rounded-lg ring-1 ring-zinc-200">
                    {selectedData.checkIns.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900">
                            {personal
                              ? (c.class?.name ?? 'Turma removida')
                              : (c.student?.name ?? 'Aluno removido')}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {new Date(c.checkInTime).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · a {c.distanceMeters}m do tatame
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {c.student && (
                            <BeltBadge
                              belt={c.student.belt}
                              degree={c.student.degree}
                              size="sm"
                            />
                          )}
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              c.status === 'presente'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {c.status === 'presente' ? 'Presente' : 'Atrasado'}
                          </span>

                          {c.approval === 'pendente' && (
                            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                              Aguardando confirmação
                            </span>
                          )}
                          {c.approval === 'recusado' && (
                            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                              Recusado
                            </span>
                          )}

                          {canManage && c.approval !== 'aprovado' && (
                            <Button
                              variant="secondary"
                              onClick={() => decide([c.id], 'aprovado')}
                              disabled={busy}
                            >
                              Confirmar
                            </Button>
                          )}
                          {canManage && c.approval === 'pendente' && (
                            <Button
                              variant="ghost"
                              onClick={() => decide([c.id], 'recusado')}
                              disabled={busy}
                            >
                              Recusar
                            </Button>
                          )}
                          {canManage && (
                            <Button
                              variant="ghost"
                              onClick={() => cancel(c.id)}
                              disabled={busy}
                            >
                              Cancelar
                            </Button>
                          )}
                          {personal && c.approval === 'pendente' && (
                            <Button
                              variant="ghost"
                              onClick={() => cancel(c.id)}
                              disabled={busy}
                            >
                              Cancelar meu check-in
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {turma && (
        <UploadModal
          open={uploading}
          classes={[turma]}
          presetClassId={turma.id}
          presetDate={selected}
          onClose={() => setUploading(false)}
          onDone={() => {
            setUploading(false);
            load();
            onChanged?.();
          }}
          onError={setError}
        />
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm"
            onClick={() => setZoom(null)}
          />
          <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-xl bg-white">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
              <p className="text-sm text-zinc-600">
                {zoom.uploadedBy ? `Enviada por ${zoom.uploadedBy.name}` : 'Foto do treino'}
              </p>
              <button
                onClick={() => setZoom(null)}
                aria-label="Fechar"
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center justify-center bg-zinc-900">
              <AuthImage
                photo={zoom}
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>
            {zoom.caption && (
              <p className="px-5 py-3 text-sm text-zinc-700">{zoom.caption}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
