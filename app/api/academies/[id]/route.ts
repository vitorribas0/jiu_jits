import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(3).optional(),
  address: z.string().min(5).optional(),
  latitude: z.number({ message: 'Latitude inválida' }).min(-90, 'Latitude inválida').max(90, 'Latitude inválida').optional(),
  longitude: z.number({ message: 'Longitude inválida' }).min(-180, 'Longitude inválida').max(180, 'Longitude inválida').optional(),
  checkInRadius: z.number().min(20, 'O raio precisa ter no mínimo 20 metros').max(5000, 'O raio não pode passar de 5000 metros').optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ['admin']);
  if ('error' in auth) return auth.error;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 }
    );
  }

  const { id } = await params;

  const { data, error } = await db
    .from('academies')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Academia não encontrada' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ['admin']);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  // Desativa em vez de apagar, para preservar o histórico de check-ins
  const { data, error } = await db
    .from('academies')
    .update({ active: false })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Academia não encontrada' }, { status: 404 });
  }

  return NextResponse.json({ message: 'Academia desativada' });
}
