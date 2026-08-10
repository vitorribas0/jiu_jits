import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'professor']);
  if ('error' in auth) return auth.error;

  const role = req.nextUrl.searchParams.get('role');

  let query = db
    .from('users')
    .select('id, name, email, cpf, phone, birth_date, role, belt, degree, belt_updated_at, emergency_contact, active, created_at, updated_at')
    .or('active.eq.true,active.is.null')
    .order('name', { ascending: true });

  if (role) {
    query = query.eq('role', role);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar usuários:', error);
    return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });
  }

  const transformed = (data || []).map((u: any) => ({
    ...u,
    birthDate: u.birth_date,
    beltUpdatedAt: u.belt_updated_at,
    emergencyContact: u.emergency_contact,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    birth_date: undefined,
    belt_updated_at: undefined,
    emergency_contact: undefined,
    created_at: undefined,
    updated_at: undefined,
  }));

  const cleaned = transformed.map(({ birth_date, belt_updated_at, emergency_contact, created_at, updated_at, ...rest }) => rest);

  return NextResponse.json(cleaned);
}
