'use client';

import { useActionState, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { loginAction } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null as { error?: string } | null);
  const [show, setShow] = useState(false);
  // Mantém o e-mail digitado quando a senha erra e o formulário volta.
  const [email, setEmail] = useState('');

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
            autoComplete="username"
            required
            autoFocus
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
    </form>
  );
}
