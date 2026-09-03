'use client';

import Link from 'next/link';
import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * Tela de erro do CSCX — no lugar da página em branco do Next.
 * Mostra o "digest", que é o identificador do erro nos logs do servidor.
 */
export function ErrorScreen({
  error,
  reset,
  compact = false,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? 'flex min-h-[60vh] items-center justify-center'
          : 'grid min-h-screen place-items-center bg-canvas p-6'
      }
    >
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/12 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-6 w-6" />
        </span>

        <h1 className="font-display text-xl font-semibold tracking-tight text-ink-950">
          Algo deu errado por aqui
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          A página não conseguiu carregar. Normalmente é uma falha momentânea de conexão com o
          banco de dados — tentar de novo costuma resolver.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {reset && (
            <button className="btn-primary" onClick={reset}>
              <RotateCw className="h-4 w-4" /> Tentar de novo
            </button>
          )}
          <Link href="/dashboard" className="btn-ghost">
            Ir para o início
          </Link>
          <a href="/api/health" target="_blank" rel="noreferrer" className="btn-ghost">
            Diagnóstico
          </a>
        </div>

        {error?.digest && (
          <p className="mt-5 text-[11px] text-ink-400">
            Código do erro: <code className="rounded bg-surface-2 px-1.5 py-0.5">{error.digest}</code>
            <br />
            Informe esse código ao procurar a causa nos logs do servidor.
          </p>
        )}
      </div>
    </div>
  );
}
