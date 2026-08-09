import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type Role = 'admin' | 'professor' | 'aluno';

const SECRET = process.env.NEXTAUTH_SECRET;

if (!SECRET) {
  throw new Error('NEXTAUTH_SECRET não configurada no .env.local');
}

export interface AuthPayload {
  id: string;
  email: string;
  role: Role;
}

export function issueToken(payload: AuthPayload): string {
  return jwt.sign(payload, SECRET as string, { expiresIn: '7d' });
}

/** Lê e valida o JWT. Não consulta o banco — use `authenticate` nas rotas. */
function decodeToken(req: NextRequest): AuthPayload | null {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  try {
    return jwt.verify(token, SECRET as string) as AuthPayload;
  } catch {
    return null;
  }
}

type AuthResult = { user: AuthPayload } | { error: NextResponse };

/**
 * Identifica quem está chamando conferindo o usuário no banco, não só o token.
 *
 * O JWT vale 7 dias, então sozinho ele carrega um retrato velho: alguém
 * desativado continuaria com acesso, e uma promoção a professor só valeria
 * no próximo login. Buscar o usuário aqui custa uma consulta por `id` e
 * mantém papel e situação sempre atuais.
 */
export async function authenticate(req: NextRequest): Promise<AuthResult> {
  const payload = decodeToken(req);

  if (!payload) {
    return {
      error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }),
    };
  }

  const { data: user, error } = await db
    .from('users')
    .select('id, email, role, active')
    .eq('id', payload.id)
    .single();

  if (error || !user || user.active === false) {
    return {
      error: NextResponse.json(
        { error: 'Sua conta não está mais ativa. Fale com a administração.' },
        { status: 401 }
      ),
    };
  }

  return {
    user: { id: user.id, email: user.email, role: user.role as Role },
  };
}

/**
 * Como `authenticate`, mas também exige um dos papéis informados.
 * Use: `const auth = await requireRole(req, ['admin'])` e devolva
 * `auth.error` quando ele existir.
 */
export async function requireRole(
  req: NextRequest,
  roles: Role[]
): Promise<AuthResult> {
  const result = await authenticate(req);
  if ('error' in result) return result;

  if (!roles.includes(result.user.role)) {
    return {
      error: NextResponse.json(
        { error: 'Você não tem permissão para esta ação' },
        { status: 403 }
      ),
    };
  }

  return result;
}
