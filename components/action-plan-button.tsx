'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, Loader2, Target } from 'lucide-react';
import { createPlanAction } from '@/app/actions';

/**
 * Abre um plano de recuperação para o aluno.
 *
 * Antes este botão criava o plano em silêncio, numa aba que a pessoa não
 * estava vendo — parecia que não fazia nada. Agora ele responde: diz o que
 * criou, avisa quando já existe um plano aberto, e leva direto para ele.
 */
export function ActionPlanButton({ studentId }: { studentId: string }) {
  const [pending, start] = useTransition();
  const [resultado, setResultado] = useState<
    { ok: true; titulo: string } | { ok: false; erro: string } | null
  >(null);

  function criar() {
    setResultado(null);
    start(async () => {
      const r = await createPlanAction({ studentId });
      setResultado(r.ok ? { ok: true, titulo: r.titulo } : { ok: false, erro: r.error });
    });
  }

  return (
    <div className="relative">
      <button className="btn-primary" onClick={criar} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
        Plano de ação
      </button>

      {resultado && (
        <div
          className={`absolute right-0 z-30 mt-2 w-80 rounded-xl border p-3 shadow-lg ${
            resultado.ok
              ? 'border-emerald-500/30 bg-surface'
              : 'border-amber-500/30 bg-surface'
          }`}
          role="status"
        >
          {resultado.ok ? (
            <>
              <p className="flex items-start gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                Plano criado
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">
                <strong>{resultado.titulo}</strong> — as tarefas do plano já foram distribuídas.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={`/alunos/${studentId}?tab=planos`} className="btn-ghost px-2.5 py-1 text-xs">
                  Ver no aluno
                </Link>
                <Link href="/planos-acao" className="btn-ghost px-2.5 py-1 text-xs">
                  Todos os planos
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="flex items-start gap-2 text-sm text-ink-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                {resultado.erro}
              </p>
              <div className="mt-2">
                <Link href={`/alunos/${studentId}?tab=planos`} className="btn-ghost px-2.5 py-1 text-xs">
                  Ver planos deste aluno
                </Link>
              </div>
            </>
          )}
          <button
            className="mt-2 text-[11px] text-ink-400 hover:text-ink-700"
            onClick={() => setResultado(null)}
          >
            fechar
          </button>
        </div>
      )}
    </div>
  );
}
