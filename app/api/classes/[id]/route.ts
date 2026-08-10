import { db } from '@/lib/db';
import { DAYS, BELTS } from '@/lib/types';
import { requireRole } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const updateSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  days: z.array(z.enum(DAYS)).min(1).optional(),
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  maxStudents: z.number().int().min(1).max(200).optional(),
});

type Params = { params: Promise<{ id: string }> };

interface RosterStudent {
  id: string;
  name: string;
  email: string;
  belt: string;
  degree: number;
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ['admin', 'professor']);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  const { data: turma, error: turmaError } = await db
    .from('classes')
    .select(`
      *,
      professor:professor_id (
        id, name, belt, degree
      ),
      academy:academy_id (
        id, name, address
      )
    `)
    .eq('id', id)
    .single();

  if (turmaError || !turma || turma.active === false) {
    return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
  }

  if (auth.user.role === 'professor' && turma.professor.id !== auth.user.id) {
    return NextResponse.json(
      { error: 'Você só pode ver os detalhes das suas turmas' },
      { status: 403 }
    );
  }

  // Buscar estudantes matriculados
  const { data: enrollments } = await db
    .from('class_students')
    .select(`
      student_id,
      users!inner (
        id, name, email, belt, degree
      )
    `)
    .eq('class_id', id);

  const students: RosterStudent[] = (enrollments || []).map((e: any) => ({
    id: e.student_id,
    name: e.users.name,
    email: e.users.email,
    belt: e.users.belt,
    degree: e.users.degree,
  }));

  // Buscar estatísticas de presença por aluno
  const { data: stats } = await db
    .from('check_ins')
    .select('student_id, check_in_time')
    .eq('class_id', id)
    .eq('approval', 'aprovado');

  const statsByStudent = new Map<string, { total: number; last: string }>();
  (stats || []).forEach((s) => {
    const key = s.student_id;
    const current = statsByStudent.get(key) || { total: 0, last: '' };
    current.total += 1;
    if (!current.last || s.check_in_time > current.last) {
      current.last = s.check_in_time;
    }
    statsByStudent.set(key, current);
  });

  // Ordenar por graduação (fila do tatame)
  const roster = students.map((s) => {
    const stat = statsByStudent.get(s.id);
    return {
      ...s,
      checkIns: stat?.total ?? 0,
      lastCheckIn: stat?.last ?? null,
    };
  });

  roster.sort(
    (a, b) =>
      BELTS.indexOf(b.belt as any) - BELTS.indexOf(a.belt as any) ||
      b.degree - a.degree ||
      a.name.localeCompare(b.name, 'pt-BR')
  );

  // Contar presença do mês e do dia
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { count: monthCheckIns } = await db
    .from('check_ins')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', id)
    .eq('approval', 'aprovado')
    .gte('check_in_time', startOfMonth);

  const { count: todayCheckIns } = await db
    .from('check_ins')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', id)
    .eq('approval', 'aprovado')
    .gte('check_in_time', startOfDay);

  const { count: pending } = await db
    .from('check_ins')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', id)
    .eq('approval', 'pendente');

  return NextResponse.json({
    turma,
    students: roster,
    stats: { monthCheckIns: monthCheckIns || 0, todayCheckIns: todayCheckIns || 0, pending: pending || 0 },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ['admin', 'professor']);
  if ('error' in auth) return auth.error;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 }
    );
  }

  const { id } = await params;

  const { data: target, error: fetchError } = await db
    .from('classes')
    .select('id, professor_id')
    .eq('id', id)
    .single();

  if (fetchError || !target) {
    return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
  }

  if (auth.user.role === 'professor' && target.professor_id !== auth.user.id) {
    return NextResponse.json(
      { error: 'Você só pode editar suas próprias turmas' },
      { status: 403 }
    );
  }

  const updateData: Record<string, any> = { ...parsed.data, updated_at: new Date().toISOString() };
  if (parsed.data.startTime) updateData.start_time = parsed.data.startTime;
  if (parsed.data.endTime) updateData.end_time = parsed.data.endTime;
  if (parsed.data.maxStudents) updateData.max_students = parsed.data.maxStudents;
  delete updateData.startTime;
  delete updateData.endTime;
  delete updateData.maxStudents;

  const { data: updated, error } = await db
    .from('classes')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      professor:professor_id (
        id, name, belt, degree
      ),
      academy:academy_id (
        id, name, address, latitude, longitude, check_in_radius
      )
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Erro ao atualizar turma' }, { status: 500 });
  }

  const result = {
    ...updated,
    startTime: updated.start_time,
    endTime: updated.end_time,
    maxStudents: updated.max_students,
    start_time: undefined,
    end_time: undefined,
    max_students: undefined,
  };

  const { start_time, end_time, max_students, ...cleaned } = result;

  return NextResponse.json(cleaned);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ['admin', 'professor']);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  const { data: target, error: fetchError } = await db
    .from('classes')
    .select('id, professor_id')
    .eq('id', id)
    .single();

  if (fetchError || !target) {
    return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
  }

  if (auth.user.role === 'professor' && target.professor_id !== auth.user.id) {
    return NextResponse.json(
      { error: 'Você só pode remover suas próprias turmas' },
      { status: 403 }
    );
  }

  await db
    .from('classes')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({ message: 'Turma removida' });
}
