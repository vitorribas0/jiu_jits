import { db } from '@/lib/db';
import { authenticate } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if ('error' in auth) return auth.error;

  const month = req.nextUrl.searchParams.get('month');
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json(
      { error: 'Informe o mês no formato AAAA-MM' },
      { status: 400 }
    );
  }

  const [year, mon] = month.split('-').map(Number);
  const from = new Date(Date.UTC(year, mon - 1, 1));
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(Date.UTC(year, mon, 1));
  to.setUTCDate(to.getUTCDate() + 1);

  // Buscar turmas em que o aluno está matriculado
  const { data: enrollments } = await db
    .from('class_students')
    .select(`
      class_id,
      classes!inner (
        id, days, active
      )
    `)
    .eq('student_id', auth.user.id);

  const enrolled = (enrollments || [])
    .filter((e: any) => e.classes.active !== false)
    .map((e: any) => ({
      id: e.class_id,
      days: e.classes.days,
    }));

  const classIds = enrolled.map((c: any) => c.id);

  // Dias de treino das turmas (sem repetir)
  const trainingDays = [
    ...new Set(enrolled.flatMap((c: any) => (c.days as any[]) || [])),
  ];

  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const [{ data: checkIns }, { data: photos }] = await Promise.all([
    db
      .from('check_ins')
      .select(`
        *,
        class:class_id (
          id, name, start_time, end_time
        )
      `)
      .eq('student_id', auth.user.id)
      .gte('check_in_time', fromIso)
      .lt('check_in_time', toIso)
      .order('check_in_time', { ascending: true }),
    db
      .from('photos')
      .select(`
        *,
        uploaded_by:uploaded_by (
          id, name
        ),
        class:class_id (
          id, name
        )
      `)
      .in('class_id', classIds.length > 0 ? classIds : ['null'])
      .or('active.eq.true,active.is.null')
      .gte('taken_at', fromIso)
      .lt('taken_at', toIso)
      .order('created_at', { ascending: true }),
  ]);

  return NextResponse.json({ month, checkIns, photos, trainingDays });
}
