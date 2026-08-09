'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Field, Input } from '@/app/components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Não foi possível entrar');
        return;
      }

      localStorage.setItem('token', data.token);
      router.replace('/dashboard');
    } catch {
      setError('Não foi possível falar com o servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl" aria-hidden>
            🥋
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Gaviões</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Entre para bater ponto no tatame
          </p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && <Alert kind="error">{error}</Alert>}

            <Field label="E-mail">
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </Field>

            <Field label="Senha">
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            <Button type="submit" full disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-600">
          Ainda não tem conta?{' '}
          <Link
            href="/register"
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
