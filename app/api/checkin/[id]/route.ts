import { db } from '@/lib/db';
import { authenticate } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await authenticate(req);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  const { data: checkIn, error: fetchError } = await db
    .from('check_ins')
    .select('id, student_id, class_id, approval')
    .eq('id', id)
    .single();

  if (fetchError || !checkIn) {
    return NextResponse.json({ error: 'Check-in não encontrado' }, { status: 404 });
  }

  if (auth.user.role === 'aluno') {
    if (checkIn.student_id !== auth.user.id) {
      return NextResponse.json(
        { error: 'Você só pode cancelar o seu próprio check-in' },
        { status: 403 }
      );
    }

    if (checkIn.approval !== 'pendente') {
      return NextResponse.json(
        {
          error: 'O professor já confirmou esta presença. Fale com ele para desfazer.',
        },
        { status: 409 }
      );
    }
  } else if (auth.user.role === 'professor') {
    const { data: turma } = await db
      .from('classes')
      .select('id, professor_id')
      .eq('id', checkIn.class_id)
      .single();

    if (!turma || turma.professor_id !== auth.user.id) {
      return NextResponse.json(
        { error: 'Você só pode cancelar presenças das suas turmas' },
        { status: 403 }
      );
    }
  }

  await db.from('check_ins').delete().eq('id', id);

  return NextResponse.json({ message: 'Check-in cancelado' });
}
