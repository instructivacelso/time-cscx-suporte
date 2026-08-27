'use client';

import { useState, useTransition } from 'react';
import { Database, Loader2, Sparkles } from 'lucide-react';
import { seedDemoAction } from '@/app/actions';

/**
 * Aviso mostrado no painel quando ainda não há alunos cadastrados.
 * Dá o caminho para popular a base sem precisar de terminal.
 */
export function EmptyDatabaseNotice({ isAdmin }: { isAdmin: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<
    { ok: true; alunos: number; cursos: number; email: string; senha: string } | { ok: false; msg: string } | null
  >(null);
  const [confirming, setConfirming] = useState(false);

  function seed() {
    start(async () => {
      const r = await seedDemoAction();
      setResult(
        r.ok
          ? { ok: true, alunos: r.alunos, cursos: r.cursos, email: r.adminEmail, senha: r.senha }
          : { ok: false, msg: r.error ?? 'Não consegui popular a base.' },
      );
      setConfirming(false);
    });
  }

  return (
    <div className="mb-5 rounded-xl border border-brand-500/25 bg-brand-500/[0.07] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-500">
          <Database className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink-900">Sua base ainda está vazia</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            Nenhum aluno foi cadastrado, por isso os indicadores aparecem zerados. Você pode
            importar os alunos do LMS pela API de integração, cadastrar manualmente, ou popular com
            dados de demonstração para conhecer o sistema funcionando.
          </p>

          {result && !result.ok && (
            <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
              {result.msg}
            </p>
          )}

          {result?.ok && (
            <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] p-3">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Pronto — {result.alunos} alunos e {result.cursos} cursos criados.
              </p>
              <p className="mt-1.5 text-sm text-ink-700">
                A equipe de exemplo entra com a senha{' '}
                <code className="rounded bg-surface px-1.5 py-0.5">{result.senha}</code>. Sua conta
                continua com a senha de sempre.
              </p>
            </div>
          )}

          {isAdmin && !result?.ok && (
            <div className="mt-3">
              {confirming ? (
                <div className="rounded-lg border border-line bg-surface p-3">
                  <p className="text-sm text-ink-700">
                    Isso <strong>apaga alunos, cursos, pesquisas e histórico</strong> que existirem
                    e cria 72 alunos fictícios no lugar. Use só enquanto a base for de teste.
                  </p>
                  <p className="mt-1.5 text-xs text-ink-500">
                    Sua conta e as dos outros usuários são preservadas — você continua logado.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-primary" onClick={seed} disabled={pending}>
                      {pending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {pending ? 'Populando…' : 'Sim, popular a base'}
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => setConfirming(false)}
                      disabled={pending}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn-ghost" onClick={() => setConfirming(true)}>
                  <Sparkles className="h-4 w-4" /> Popular com dados de demonstração
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
