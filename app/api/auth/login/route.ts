import { db } from '@/lib/db';
import { issueToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const { email, password } = validation.data;

    const { data: user, error } = await db
      .from('users')
      .select('id, email, password, name, role, belt, degree, active')
      .eq('email', email)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    if (user.active === false) {
      return NextResponse.json(
        { error: 'Sua conta não está mais ativa. Fale com a administração.' },
        { status: 403 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    const token = issueToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json(
      {
        message: 'Login realizado com sucesso',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          belt: user.belt,
          degree: user.degree,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return NextResponse.json({ error: 'Erro ao fazer login' }, { status: 500 });
  }
}
