import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  cpf: z.string().min(11),
  phone: z.string().min(10),
  birthDate: z.string(),
  emergencyContact: z.object({
    name: z.string(),
    phone: z.string(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password, cpf, phone, birthDate, emergencyContact } = validation.data;

    // Verificar se email ou CPF já existem
    const { data: existing } = await db
      .from('users')
      .select('id')
      .or(`email.eq.${email},cpf.eq.${cpf}`)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Email ou CPF já cadastrado' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: user, error } = await db
      .from('users')
      .insert([
        {
          name,
          email,
          password: hashedPassword,
          cpf,
          phone,
          birth_date: new Date(birthDate).toISOString(),
          emergency_contact: emergencyContact,
          role: 'aluno',
          belt: 'branca',
          degree: 0,
        },
      ])
      .select('id, name, email, role')
      .single();

    if (error) {
      console.error('Erro ao registrar:', error);
      if (error.code === '23505') {
        // Unique constraint violation
        return NextResponse.json(
          { error: 'Email ou CPF já cadastrado' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Erro ao registrar usuário' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Usuário criado com sucesso',
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao registrar:', error);
    return NextResponse.json(
      { error: 'Erro ao registrar usuário' },
      { status: 500 }
    );
  }
}
