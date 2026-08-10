import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { BELTS, ROLES } from '@/lib/types';
import { requireRole } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(3, 'Nome precisa de ao menos 3 letras').optional(),
  email: z.string().email('E-mail inválido').optional(),
  cpf: z.string().min(11, 'CPF precisa de 11 dígitos').optional(),
  phone: z.string().min(10, 'Telefone incompleto').optional(),
  birthDate: z.string().optional(),
  emergencyContact: z
    .object({
      name: z.string().min(1, 'Informe o nome do contato'),
      phone: z.string().min(10, 'Telefone do contato incompleto'),
    })
    .optional(),
  role: z.enum(ROLES).optional(),
  belt: z.enum(BELTS).optional(),
  degree: z.number().int().min(0).max(4).optional(),
  password: z.string().min(6, 'A senha precisa de ao menos 6 caracteres').optional(),
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

  // Um admin não pode rebaixar a si mesmo
  if (id === auth.user.id && parsed.data.role && parsed.data.role !== 'admin') {
    return NextResponse.json(
      { error: 'Você não pode remover seu próprio acesso de admin' },
      { status: 400 }
    );
  }

  const { password, birthDate, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };

  if (birthDate) update.birth_date = new Date(birthDate).toISOString();
  if (password) update.password = await bcrypt.hash(password, 10);
  if (parsed.data.belt || parsed.data.degree !== undefined) {
    update.belt_updated_at = new Date().toISOString();
  }

  try {
    const { data: user, error } = await db
      .from('users')
      .update(update)
      .eq('id', id)
      .select('id, name, email, cpf, phone, birth_date, role, belt, degree, belt_updated_at, emergency_contact, active, created_at, updated_at')
      .single();

    if (error || !user) {
      if (error?.code === '23505') {
        const message = error.message.includes('email')
          ? 'Já existe outro usuário com este e-mail'
          : 'Já existe outro usuário com este CPF';
        return NextResponse.json({ error: message }, { status: 409 });
      }
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    const transformed = {
      ...user,
      birthDate: user.birth_date,
      beltUpdatedAt: user.belt_updated_at,
      emergencyContact: user.emergency_contact,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    const { birth_date, belt_updated_at, emergency_contact, created_at, updated_at, ...cleaned } = transformed;

    return NextResponse.json(cleaned);
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    return NextResponse.json(
      { error: 'Erro ao atualizar usuário' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ['admin']);
  if ('error' in auth) return auth.error;

  const { id } = await params;
  if (id === auth.user.id) {
    return NextResponse.json(
      { error: 'Você não pode desativar sua própria conta' },
      { status: 400 }
    );
  }

  const { data: user, error } = await db
    .from('users')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ message: 'Usuário desativado' });
}
