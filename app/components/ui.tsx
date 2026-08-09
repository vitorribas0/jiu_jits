'use client';

import { ReactNode } from 'react';

/* ---------------------------------------------------------------- Faixa --- */

const BELT_STYLES: Record<string, { bar: string; text: string; bg: string }> = {
  branca: { bar: 'bg-zinc-200', text: 'text-zinc-700', bg: 'bg-zinc-100' },
  azul: { bar: 'bg-blue-600', text: 'text-blue-700', bg: 'bg-blue-50' },
  roxa: { bar: 'bg-purple-600', text: 'text-purple-700', bg: 'bg-purple-50' },
  marrom: { bar: 'bg-amber-800', text: 'text-amber-900', bg: 'bg-amber-50' },
  preta: { bar: 'bg-zinc-900', text: 'text-zinc-900', bg: 'bg-zinc-100' },
};

/** Cor sólida da faixa, para usar como marcador de hierarquia em listas. */
export function beltBarColor(belt: string) {
  return (BELT_STYLES[belt] ?? BELT_STYLES.branca).bar;
}

export function BeltBadge({
  belt,
  degree,
  size = 'md',
}: {
  belt: string;
  degree: number;
  size?: 'sm' | 'md';
}) {
  const style = BELT_STYLES[belt] ?? BELT_STYLES.branca;
  const isSmall = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full ${style.bg} ${
        isSmall ? 'px-2.5 py-1' : 'px-3 py-1.5'
      } ring-1 ring-black/5`}
    >
      <span
        className={`flex ${isSmall ? 'h-3 w-8' : 'h-4 w-11'} overflow-hidden rounded-sm ${style.bar} ring-1 ring-black/10`}
      >
        {/* ponteira preta com os graus */}
        <span className="ml-auto flex h-full w-[42%] items-center justify-center gap-[2px] bg-zinc-900 px-[2px]">
          {Array.from({ length: degree }).map((_, i) => (
            <span key={i} className="h-full w-[2px] bg-white" />
          ))}
        </span>
      </span>
      <span
        className={`font-semibold capitalize ${style.text} ${
          isSmall ? 'text-xs' : 'text-sm'
        }`}
      >
        {belt}
        {degree > 0 && ` ${degree}º`}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------- Botão --- */

type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  full?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  variant = 'primary',
  full,
  className = '',
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-indigo-600 shadow-sm',
    secondary:
      'bg-white text-zinc-800 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        variants[variant]
      } ${full ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- Card --- */

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900">
          {icon && <span aria-hidden>{icon}</span>}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------- Campo --- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-zinc-800">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

const fieldStyles =
  'w-full rounded-lg border-0 bg-white px-3.5 py-2.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 disabled:bg-zinc-50';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldStyles} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldStyles} ${props.className ?? ''}`} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea {...props} className={`${fieldStyles} ${props.className ?? ''}`} />
  );
}

/* ---------------------------------------------------------------- Alert --- */

export function Alert({
  kind,
  children,
}: {
  kind: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  const styles = {
    error: 'bg-red-50 text-red-800 ring-red-200',
    success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    info: 'bg-blue-50 text-blue-800 ring-blue-200',
  };
  const icons = { error: '⚠️', success: '✅', info: 'ℹ️' };

  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm font-medium ring-1 ring-inset ${styles[kind]}`}
    >
      <span aria-hidden>{icons[kind]}</span>
      <span>{children}</span>
    </div>
  );
}

/* ----------------------------------------------------------------- Stat --- */

export function Stat({
  label,
  value,
  icon,
  accent = 'indigo',
}: {
  label: string;
  value: string | number;
  icon: string;
  accent?: 'indigo' | 'emerald' | 'amber' | 'purple';
}) {
  const accents = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl ${accents[accent]}`}
          aria-hidden
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-zinc-600">{label}</p>
          <p className="text-2xl font-bold text-zinc-900">{value}</p>
        </div>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------- Vazio -- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 text-5xl" aria-hidden>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-zinc-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-600">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- Modal --- */

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
