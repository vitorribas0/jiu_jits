'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Field, Input } from '@/app/components/ui';

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    cpf: '',
    phone: '',
    birthDate: '',
    emergencyName: '',
    emergencyPhone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          cpf: form.cpf.replace(/\D/g, ''),
          phone: form.phone,
          birthDate: form.birthDate,
          emergencyContact: {
            name: form.emergencyName,
            phone: form.emergencyPhone,
          },
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Não foi possível criar a conta');
        return;
      }

      router.replace('/login');
    } catch {
      setError('Não foi possível falar com o servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl" aria-hidden>
            🥋
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Criar conta</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Comece a registrar sua presença nos treinos
          </p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <form onSubmit={handleRegister} className="space-y-4">
            {error && <Alert kind="error">{error}</Alert>}

            <Field label="Nome completo">
              <Input required value={form.name} onChange={set('name')} />
            </Field>

            <Field label="E-mail">
              <Input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={set('email')}
                placeholder="voce@email.com"
              />
            </Field>

            <Field label="Senha" hint="Mínimo de 6 caracteres.">
              <Input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={form.password}
                onChange={set('password')}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="CPF">
                <Input
                  required
                  value={form.cpf}
                  onChange={set('cpf')}
                  placeholder="000.000.000-00"
                />
              </Field>
              <Field label="Telefone">
                <Input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="(11) 99999-9999"
                />
              </Field>
            </div>

            <Field label="Data de nascimento">
              <Input
                type="date"
                required
                value={form.birthDate}
                onChange={set('birthDate')}
              />
            </Field>

            <div className="rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-200">
              <p className="mb-3 text-sm font-semibold text-zinc-800">
                🚨 Contato de emergência
              </p>
              <div className="space-y-3">
                <Field label="Nome">
                  <Input
                    required
                    value={form.emergencyName}
                    onChange={set('emergencyName')}
                  />
                </Field>
                <Field label="Telefone">
                  <Input
                    type="tel"
                    required
                    value={form.emergencyPhone}
                    onChange={set('emergencyPhone')}
                  />
                </Field>
              </div>
            </div>

            <Button type="submit" full disabled={loading}>
              {loading ? 'Criando conta…' : 'Criar conta'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-600">
          Já tem conta?{' '}
          <Link
            href="/login"
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
