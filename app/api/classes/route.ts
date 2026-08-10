import { db } from '@/lib/db';
import { DAYS, ROLES } from '@/lib/types';
import { requireRole, authenticate } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const createSchema = z
  .object({
    name: z.string().min(3, 'Nome da turma precisa de ao menos 3 letras'),
    description: z.string().optional(),
    academy: z.string().min(1, 'Selecione a academia'),
    professor: z.string().min(1, 'Selecione o professor'),
    days: z.array(z.enum(DAYS)).min(1, 'Escolha ao menos um dia da semana'),
    startTime: z.string().regex(timeRegex, 'Horário de início inválido'),
    endTime: z.string().regex(timeRegex, 'Horário de término inválido'),
    maxStudents: z.number().int().min(1).max(200).optional(),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: 'O horário de término precisa ser depois do início',
  });

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if ('error' in auth) return auth.error;
  const user = auth.user;

  let query = db
    .from('classes')
    .select(`
      *,
      professor:professor_id (
        id, name, belt, degree
      ),
      academy:academy_id (
        id, name, address, latitude, longitude, check_in_radius
      )
    `)
    .or('active.eq.true,active.is.null')
    .order('name', { ascending: true });

  // Professor vê só as turmas dele; admin e aluno veem todas
  const mine = req.nextUrl.searchParams.get('mine');
  if (mine === 'true' && user.role === 'professor') {
    query = query.eq('professor_id', user.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar turmas:', error);
    return NextResponse.json({ error: 'Erro ao buscar turmas' }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'professor']);
  if ('error' in auth) return auth.error;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 }
    );
  }

  // Professor só cria turma para si mesmo; admin escolhe qualquer professor
  const professor_id = auth.user.role === 'professor' ? auth.user.id : parsed.data.professor;

  const { data: created, error } = await db
    .from('classes')
    .insert([
      {
        name: parsed.data.name,
        description: parsed.data.description,
        academy_id: parsed.data.academy,
        professor_id,
        days: parsed.data.days,
        start_time: parsed.data.startTime,
        end_time: parsed.data.endTime,
        max_students: parsed.data.maxStudents,
      },
    ])
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
    console.error('Erro ao criar turma:', error);
    return NextResponse.json({ error: 'Erro ao criar turma' }, { status: 500 });
  }

  return NextResponse.json(created, { status: 201 });
}
