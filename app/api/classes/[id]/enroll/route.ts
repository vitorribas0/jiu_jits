import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ['aluno']);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  const { data: target, error: classError } = await db
    .from('classes')
    .select('id, max_students')
    .eq('id', id)
    .or('active.eq.true,active.is.null')
    .single();

  if (classError || !target) {
    return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });
  }

  // Verificar se já está matriculado
  const { data: existing } = await db
    .from('class_students')
    .select('*')
    .eq('class_id', id)
    .eq('student_id', auth.user.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'Você já está matriculado nesta turma' },
      { status: 409 }
    );
  }

  // Verificar lotação
  if (target.max_students) {
    const { count } = await db
      .from('class_students')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', id);

    if ((count || 0) >= target.max_students) {
      return NextResponse.json({ error: 'Turma lotada' }, { status: 409 });
    }
  }

  const { error } = await db
    .from('class_students')
    .insert([{ class_id: id, student_id: auth.user.id }]);

  if (error) {
    console.error('Erro ao matricular:', error);
    return NextResponse.json({ error: 'Erro ao matricular' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Matrícula confirmada' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ['aluno']);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  await db
    .from('class_students')
    .delete()
    .eq('class_id', id)
    .eq('student_id', auth.user.id);

  return NextResponse.json({ message: 'Matrícula cancelada' });
}
