import { db } from '@/lib/db';
import { requireRole, authenticate } from '@/lib/auth';
import { distanceInMeters } from '@/lib/geo';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const checkInSchema = z.object({
  classId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
});

const MAX_ACCURACY_ALLOWANCE_M = 100;

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['aluno']);
  if ('error' in auth) return auth.error;

  const parsed = checkInSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 }
    );
  }

  const { classId, latitude, longitude, accuracy } = parsed.data;

  const { data: turma, error: classError } = await db
    .from('classes')
    .select('id, academy_id, start_time')
    .eq('id', classId)
    .or('active.eq.true,active.is.null')
    .single();

  if (classError || !turma) {
    return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
  }

  const { data: academy, error: academyError } = await db
    .from('academies')
    .select('id, latitude, longitude, check_in_radius')
    .eq('id', turma.academy_id)
    .single();

  if (academyError || !academy) {
    return NextResponse.json(
      { error: 'Academia da turma não encontrada' },
      { status: 404 }
    );
  }

  // Bloqueia check-in duplicado no mesmo dia
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data: existing } = await db
    .from('check_ins')
    .select('id')
    .eq('student_id', auth.user.id)
    .eq('class_id', classId)
    .gte('check_in_time', startOfDay.toISOString())
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'Você já fez check-in nesta turma hoje' },
      { status: 409 }
    );
  }

  const distance = distanceInMeters(latitude, longitude, academy.latitude, academy.longitude);
  const allowed = academy.check_in_radius + Math.min(accuracy ?? 0, MAX_ACCURACY_ALLOWANCE_M);

  if (distance > allowed) {
    return NextResponse.json(
      {
        error: `Você está a ${distance}m da academia. É preciso estar a menos de ${academy.check_in_radius}m para fazer check-in.`,
        distanceMeters: distance,
      },
      { status: 422 }
    );
  }

  // Marca atraso se chegou mais de 15 min depois do início da aula
  const now = new Date();
  const [h, m] = turma.start_time.split(':').map(Number);
  const classStart = new Date(now);
  classStart.setHours(h, m, 0, 0);
  const lateByMin = (now.getTime() - classStart.getTime()) / 60000;

  const { data: checkIn, error } = await db
    .from('check_ins')
    .insert([
      {
        student_id: auth.user.id,
        class_id: classId,
        academy_id: academy.id,
        check_in_time: now.toISOString(),
        location: { latitude, longitude, accuracy },
        distance_meters: distance,
        status: lateByMin > 15 ? 'atrasado' : 'presente',
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Erro ao fazer check-in:', error);
    return NextResponse.json({ error: 'Erro ao fazer check-in' }, { status: 500 });
  }

  return NextResponse.json(
    {
      message:
        checkIn.status === 'atrasado'
          ? 'Check-in registrado com atraso. Aguarde a confirmação do professor.'
          : 'Check-in registrado! Aguarde a confirmação do professor.',
      checkIn,
    },
    { status: 201 }
  );
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if ('error' in auth) return auth.error;
  const user = auth.user;

  const classId = req.nextUrl.searchParams.get('classId');
  let query = db
    .from('check_ins')
    .select(`
      *,
      student:student_id (
        id, name, belt, degree
      ),
      class:class_id (
        id, name, start_time, end_time
      )
    `)
    .order('check_in_time', { ascending: false })
    .limit(200);

  if (user.role === 'aluno') {
    // Aluno vê apenas o próprio histórico
    query = query.eq('student_id', user.id);
    if (classId) {
      query = query.eq('class_id', classId);
    }
  } else if (user.role === 'professor') {
    // Professor vê só as turmas que conduz
    const { data: ownClasses } = await db
      .from('classes')
      .select('id')
      .eq('professor_id', user.id);

    const ownIds = (ownClasses || []).map((c: any) => c.id);

    if (classId) {
      if (!ownIds.includes(classId)) {
        return NextResponse.json(
          { error: 'Você só pode ver a presença das suas turmas' },
          { status: 403 }
        );
      }
      query = query.eq('class_id', classId);
    } else {
      query = query.in('class_id', ownIds);
    }
  } else if (classId) {
    query = query.eq('class_id', classId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar check-ins:', error);
    return NextResponse.json({ error: 'Erro ao buscar check-ins' }, { status: 500 });
  }

  return NextResponse.json(data);
}
