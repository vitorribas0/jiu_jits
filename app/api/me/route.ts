import { db } from '@/lib/db';
import { authenticate } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if ('error' in auth) return auth.error;

  const { data: user, error } = await db
    .from('users')
    .select('id, name, email, cpf, phone, birth_date, role, belt, degree, belt_updated_at, emergency_contact, active, created_at, updated_at')
    .eq('id', auth.user.id)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: totalCheckIns } = await db
    .from('check_ins')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', user.id)
    .eq('approval', 'aprovado');

  const { count: monthCheckIns } = await db
    .from('check_ins')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', user.id)
    .eq('approval', 'aprovado')
    .gte('check_in_time', startOfMonth.toISOString());

  const { count: myPending } = await db
    .from('check_ins')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', user.id)
    .eq('approval', 'pendente');

  // Quantos check-ins esperam confirmação
  let pendingApprovals = 0;
  if (user.role === 'professor') {
    const { data: ownClasses } = await db
      .from('classes')
      .select('id')
      .eq('professor_id', user.id);

    const { count } = await db
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .in('class_id', (ownClasses || []).map((c: any) => c.id))
      .eq('approval', 'pendente');

    pendingApprovals = count || 0;
  } else if (user.role === 'admin') {
    const { count } = await db
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .eq('approval', 'pendente');

    pendingApprovals = count || 0;
  }

  const transformedUser = {
    ...user,
    birthDate: user.birth_date,
    beltUpdatedAt: user.belt_updated_at,
    emergencyContact: user.emergency_contact,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };

  const { birth_date, belt_updated_at, emergency_contact, created_at, updated_at, ...cleanedUser } = transformedUser;

  return NextResponse.json({
    user: cleanedUser,
    stats: {
      totalCheckIns: totalCheckIns || 0,
      monthCheckIns: monthCheckIns || 0,
      myPending: myPending || 0,
      pendingApprovals,
    },
  });
}
