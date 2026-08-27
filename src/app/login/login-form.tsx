'use client';

import { useActionState, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { loginAction } from './actions';

const DEMO = [
  { role: 'Administrador', email: 'admin@escolainstructiva.com.br' },
  { role: 'Coordenador CSCX', email: 'coordenacao@escolainstructiva.com.br' },
  { role: 'Analista CSCX', email: 'analista@escolainstructiva.com.br' },
  { role: 'Aluno', email: 'aluno@exemplo.com.br' },
];

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null as { error?: string } | null);
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('admin@escolainstructiva.com.br');
  const [open, setOpen] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <div className="relative mt-1.5">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input py-2.5 pl-10"
            placeholder="voce@escolainstructiva.com.br"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="password">
          Senha
        </label>
        <div className="relative mt-1.5">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            id="password"
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            defaultValue="cscx2026"
            className="input py-2.5 pl-10 pr-11"
            placeholder="Sua senha"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
            title={show ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-400 transition hover:bg-surface-2 hover:text-ink-700"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full py-2.5 text-[15px]">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Entrar <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <p className="text-center text-xs text-ink-500">
        Esqueceu a senha? Fale com o administrador do CSCX.
      </p>

      <div className="rounded-xl border border-line bg-surface-2/70 p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between text-xs font-medium text-ink-600 hover:text-ink-900"
        >
          Acessos de demonstração
          <span className="text-ink-400">{open ? '−' : '+'}</span>
        </button>

        {open && (
          <ul className="mt-2.5 space-y-1.5">
            {DEMO.map((d) => (
              <li key={d.email}>
                <button
                  type="button"
                  onClick={() => setEmail(d.email)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-surface"
                >
                  <span className="shrink-0 text-ink-500">{d.role}</span>
                  <code className="truncate text-[11px] text-ink-700">{d.email}</code>
                </button>
              </li>
            ))}
            <li className="px-2 pt-1 text-[11px] text-ink-400">Senha de demonstração: cscx2026</li>
          </ul>
        )}
      </div>
    </form>
  );
}
