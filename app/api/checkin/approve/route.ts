import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const approveSchema = z.object({
  ids: z.array(z.string()).min(1, 'Selecione ao menos um check-in'),
  approval: z.enum(['aprovado', 'recusado'], {
    message: 'A presença só pode ser confirmada ou recusada',
  }),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'professor']);
  if ('error' in auth) return auth.error;

  const parsed = approveSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 }
    );
  }

  const { ids, approval } = parsed.data;
  const now = new Date().toISOString();

  let query = db
    .from('check_ins')
    .update({
      approval,
      approved_by: auth.user.id,
      approved_at: now,
      updated_at: now,
    })
    .in('id', ids);

  // Professor só mexe na presença das turmas que conduz
  if (auth.user.role === 'professor') {
    const { data: ownClasses } = await db
      .from('classes')
      .select('id')
      .eq('professor_id', auth.user.id);

    const ownIds = (ownClasses || []).map((c: any) => c.id);
    query = query.in('class_id', ownIds);
  }

  const { error, count } = await query;

  if (error || !count) {
    console.error('Erro ao aprovar check-ins:', error);
    return NextResponse.json(
      { error: 'Nenhum check-in seu foi encontrado com esses identificadores' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    message:
      count === 1
        ? `Check-in ${approval}`
        : `${count} check-ins ${approval}s`,
    updated: count,
  });
}
