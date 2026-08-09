import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ['admin', 'professor']);
  if ('error' in auth) return auth.error;

  const { id } = await params;
  const month = req.nextUrl.searchParams.get('month');

  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json(
      { error: 'Informe o mês no formato AAAA-MM' },
      { status: 400 }
    );
  }

  const { data: turma, error: classError } = await db
    .from('classes')
    .select('id, professor_id, active')
    .eq('id', id)
    .single();

  if (classError || !turma || turma.active === false) {
    return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
  }

  if (auth.user.role === 'professor' && turma.professor_id !== auth.user.id) {
    return NextResponse.json(
      { error: 'Você só pode ver a agenda das suas turmas' },
      { status: 403 }
    );
  }

  const [year, mon] = month.split('-').map(Number);
  const from = new Date(Date.UTC(year, mon - 1, 1));
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(Date.UTC(year, mon, 1));
  to.setUTCDate(to.getUTCDate() + 1);

  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const [{ data: checkIns }, { data: photos }] = await Promise.all([
    db
      .from('check_ins')
      .select(`
        *,
        student:student_id (
          id, name, belt, degree
        )
      `)
      .eq('class_id', id)
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
      .eq('class_id', id)
      .or('active.eq.true,active.is.null')
      .gte('taken_at', fromIso)
      .lt('taken_at', toIso)
      .order('created_at', { ascending: true }),
  ]);

  return NextResponse.json({ month, checkIns, photos });
}
