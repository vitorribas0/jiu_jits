import { db } from '@/lib/db';
import { authenticate } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

/** A academia e as turmas que acontecem nela, para o aluno escolher onde treinar. */
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await authenticate(req);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  const { data: academy, error: academyError } = await db
    .from('academies')
    .select('*')
    .eq('id', id)
    .single();

  if (academyError || !academy || academy.active === false) {
    return NextResponse.json({ error: 'Academia não encontrada' }, { status: 404 });
  }

  const { data: classes, error: classesError } = await db
    .from('classes')
    .select(`
      *,
      professor:professor_id (
        id, name, belt, degree
      )
    `)
    .eq('academy_id', id)
    .or('active.eq.true,active.is.null')
    .order('start_time', { ascending: true })
    .order('name', { ascending: true });

  if (classesError) {
    console.error('Erro ao buscar turmas:', classesError);
    return NextResponse.json({ error: 'Erro ao buscar turmas' }, { status: 500 });
  }

  return NextResponse.json({ academy, classes });
}
