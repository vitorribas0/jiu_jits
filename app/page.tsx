'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const FEATURES = [
  {
    icon: '📍',
    title: 'Check-in com GPS',
    text: 'A presença só é aceita se o aluno estiver de fato dentro da academia.',
  },
  {
    icon: '🥋',
    title: 'Faixas e graus',
    text: 'Graduação no padrão IBJJF, da branca à preta, com histórico de promoções.',
  },
  {
    icon: '📊',
    title: 'Frequência no tatame',
    text: 'Cada treino fica registrado, com data, horário e distância do tatame.',
  },
];

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem('token')) router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-lg font-bold text-zinc-900">
            <span aria-hidden>🥋</span> Gaviões
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Criar conta
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            A gestão da sua academia
            <br />
            <span className="text-indigo-600">no mesmo lugar</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-600">
            Controle de presença por geolocalização, graduação de faixas e
            frequência dos alunos — feito para academias de jiu-jitsu.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Começar agora
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-800 ring-1 ring-inset ring-zinc-300 transition hover:bg-zinc-50"
            >
              Já sou aluno
            </Link>
          </div>
        </section>

        <section className="grid gap-6 pb-20 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200"
            >
              <div className="mb-3 text-3xl" aria-hidden>
                {f.icon}
              </div>
              <h2 className="font-bold text-zinc-900">{f.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                {f.text}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white py-8">
        <p className="text-center text-sm text-zinc-500">
          🥋 Gaviões — Academia de Jiu-Jitsu
        </p>
      </footer>
    </div>
  );
}
