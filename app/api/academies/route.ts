import { db } from '@/lib/db';
import { requireRole, authenticate } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const academySchema = z.object({
  name: z.string().min(3, 'Nome precisa de ao menos 3 letras'),
  address: z.string().min(5, 'Endereço muito curto'),
  latitude: z.number({ message: 'Latitude inválida' }).min(-90, 'Latitude inválida').max(90, 'Latitude inválida'),
  longitude: z.number({ message: 'Longitude inválida' }).min(-180, 'Longitude inválida').max(180, 'Longitude inválida'),
  checkInRadius: z.number().min(20, 'O raio precisa ter no mínimo 20 metros').max(5000, 'O raio não pode passar de 5000 metros').default(150),
});

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if ('error' in auth) return auth.error;

  const { data, error } = await db
    .from('academies')
    .select('*')
    .or('active.eq.true,active.is.null')
    .order('name', { ascending: true });

  if (error) {
    console.error('Erro ao buscar academias:', error);
    return NextResponse.json({ error: 'Erro ao buscar academias' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if ('error' in auth) return auth.error;

  const parsed = academySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 }
    );
  }

  const { data, error } = await db
    .from('academies')
    .insert([parsed.data])
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar academia:', error);
    return NextResponse.json({ error: 'Erro ao criar academia' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
