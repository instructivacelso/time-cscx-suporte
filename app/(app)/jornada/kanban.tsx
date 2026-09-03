'use client';

import { useOptimistic, useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, GripVertical, Loader2 } from 'lucide-react';
import { moveStageAction } from '@/app/actions';
import { JOURNEY_STAGES, STAGE_LABELS } from '@/lib/constants';
import type { JourneyStage } from '@/db/schema';

export interface CardAluno {
  id: string;
  nome: string;
  etapa: JourneyStage;
  healthScore: number;
  healthBand: string;
  diasSemAcesso: number;
  curso: string | null;
}

const CORES_FAIXA: Record<string, string> = {
  EXCELENTE: 'bg-emerald-500',
  SAUDAVEL: 'bg-emerald-400',
  ATENCAO: 'bg-amber-400',
  RISCO: 'bg-orange-500',
  CRITICO: 'bg-rose-500',
};

/**
 * Quadro da jornada: uma coluna por etapa, um cartão por aluno.
 *
 * Move-se um aluno arrastando o cartão para outra coluna, ou pelas setas do
 * cartão (que funcionam no celular e no teclado). A mudança aparece na hora e
 * é confirmada no servidor logo em seguida.
 */
export function JourneyKanban({ alunos, podeMover }: { alunos: CardAluno[]; podeMover: boolean }) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<JourneyStage | null>(null);

  const [lista, mover] = useOptimistic(alunos, (atual: CardAluno[], m: { id: string; etapa: JourneyStage }) =>
    atual.map((a) => (a.id === m.id ? { ...a, etapa: m.etapa } : a)),
  );

  function moverPara(aluno: CardAluno, etapa: JourneyStage) {
    if (!podeMover || etapa === aluno.etapa) return;
    setErro(null);
    start(async () => {
      mover({ id: aluno.id, etapa });
      const r = await moveStageAction({ studentId: aluno.id, stage: etapa });
      if (!r.ok) setErro(r.error);
    });
  }

  return (
    <div>
      {erro && (
        <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
          {erro}
        </p>
      )}

      <div className="flex items-center gap-2 pb-2 text-xs text-ink-500">
        {podeMover ? (
          <>
            <GripVertical className="h-3.5 w-3.5" />
            Arraste o cartão para outra coluna, ou use as setas dele.
          </>
        ) : (
          'Somente leitura: seu perfil não altera a etapa dos alunos.'
        )}
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      </div>

      <div className="table-wrap overflow-x-auto">
        <div className="flex min-w-max gap-3 p-1">
          {JOURNEY_STAGES.map((etapa) => {
            const daEtapa = lista.filter((a) => a.etapa === etapa);
            const destacada = alvo === etapa;

            return (
              <section
                key={etapa}
                onDragOver={(e) => {
                  if (!podeMover || !arrastando) return;
                  e.preventDefault();
                  setAlvo(etapa);
                }}
                onDragLeave={() => setAlvo((a) => (a === etapa ? null : a))}
                onDrop={(e) => {
                  e.preventDefault();
                  setAlvo(null);
                  const aluno = lista.find((a) => a.id === arrastando);
                  if (aluno) moverPara(aluno, etapa);
                  setArrastando(null);
                }}
                className={`w-64 shrink-0 rounded-xl border p-2 transition ${
                  destacada
                    ? 'border-brand-400 bg-brand-500/[0.06]'
                    : 'border-line bg-surface-2/50'
                }`}
              >
                <header className="flex items-center justify-between px-1 pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-600">
                    {STAGE_LABELS[etapa]}
                  </h3>
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-ink-500">
                    {daEtapa.length}
                  </span>
                </header>

                <ul className="space-y-2">
                  {daEtapa.map((a) => {
                    const i = JOURNEY_STAGES.indexOf(a.etapa);
                    return (
                      <li
                        key={a.id}
                        draggable={podeMover}
                        onDragStart={() => setArrastando(a.id)}
                        onDragEnd={() => { setArrastando(null); setAlvo(null); }}
                        className={`rounded-lg border border-line bg-surface p-2.5 shadow-sm transition ${
                          podeMover ? 'cursor-grab active:cursor-grabbing hover:shadow-card' : ''
                        } ${arrastando === a.id ? 'opacity-40' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${CORES_FAIXA[a.healthBand] ?? 'bg-ink-300'}`}
                            title={`Health Score ${a.healthScore}`}
                          />
                          <Link
                            href={`/alunos/${a.id}`}
                            className="min-w-0 flex-1 text-sm font-medium text-ink-900 hover:underline"
                          >
                            {a.nome}
                          </Link>
                        </div>

                        <p className="mt-1 truncate pl-4 text-[11px] text-ink-500">
                          {a.curso ?? 'sem curso'} · {a.healthScore}/100
                        </p>
                        <p className="pl-4 text-[11px] text-ink-400">
                          {a.diasSemAcesso === 0
                            ? 'acessou hoje'
                            : `${a.diasSemAcesso} dia(s) sem acessar`}
                        </p>

                        {podeMover && (
                          <div className="mt-1.5 flex justify-end gap-1">
                            <button
                              className="rounded p-1 text-ink-400 transition hover:bg-surface-2 hover:text-ink-800 disabled:opacity-30"
                              disabled={i === 0}
                              onClick={() => moverPara(a, JOURNEY_STAGES[i - 1])}
                              aria-label={`Voltar ${a.nome} para ${STAGE_LABELS[JOURNEY_STAGES[i - 1]] ?? ''}`}
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="rounded p-1 text-ink-400 transition hover:bg-surface-2 hover:text-ink-800 disabled:opacity-30"
                              disabled={i === JOURNEY_STAGES.length - 1}
                              onClick={() => moverPara(a, JOURNEY_STAGES[i + 1])}
                              aria-label={`Avançar ${a.nome} para ${STAGE_LABELS[JOURNEY_STAGES[i + 1]] ?? ''}`}
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}

                  {daEtapa.length === 0 && (
                    <li className="rounded-lg border border-dashed border-line px-2 py-6 text-center text-[11px] text-ink-400">
                      vazio
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
