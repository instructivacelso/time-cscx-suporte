'use client';

import { useState, useTransition } from 'react';
import { Bot, Copy, Loader2, MessageSquare, Sparkles, ClipboardList } from 'lucide-react';
import { aiMessageAction, aiPlanAction, aiSummaryAction } from '@/app/actions';
import { Markdown } from './markdown';

export function AiPanel({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [output, setOutput] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [pending, start] = useTransition();
  const [intent, setIntent] = useState('Retomar os estudos e reagendar o cronograma');

  function run(kind: 'resumo' | 'plano' | 'whatsapp' | 'email' | 'feedback') {
    start(async () => {
      setTitle(
        kind === 'resumo'
          ? 'Resumo do aluno'
          : kind === 'plano'
            ? 'Plano de ação sugerido'
            : kind === 'whatsapp'
              ? 'Mensagem de WhatsApp'
              : kind === 'email'
                ? 'E-mail'
                : 'Feedback para o aluno',
      );
      setOutput('');
      let text = '';
      if (kind === 'resumo') text = await aiSummaryAction(studentId);
      else if (kind === 'plano') text = await aiPlanAction(studentId);
      else
        text = await aiMessageAction(
          studentId,
          kind === 'whatsapp' ? 'WHATSAPP' : kind === 'email' ? 'EMAIL' : 'FEEDBACK',
          intent,
        );
      setOutput(text);
    });
  }

  return (
    <div className="card card-pad">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
          <Bot className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-ink-900">Assistente CSCX</h2>
          <p className="text-xs text-ink-500">
            Analisa o histórico de {studentName.split(' ')[0]} e escreve por você.
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button className="btn-subtle" onClick={() => run('resumo')} disabled={pending}>
          <Sparkles className="h-3.5 w-3.5" /> Resumir histórico
        </button>
        <button className="btn-subtle" onClick={() => run('plano')} disabled={pending}>
          <ClipboardList className="h-3.5 w-3.5" /> Sugerir plano de ação
        </button>
        <button className="btn-subtle" onClick={() => run('whatsapp')} disabled={pending}>
          <MessageSquare className="h-3.5 w-3.5" /> Mensagem WhatsApp
        </button>
        <button className="btn-subtle" onClick={() => run('email')} disabled={pending}>
          E-mail
        </button>
        <button className="btn-subtle" onClick={() => run('feedback')} disabled={pending}>
          Feedback
        </button>
      </div>

      <label className="label" htmlFor="intent">
        Objetivo da mensagem
      </label>
      <input
        id="intent"
        className="input mt-1"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder="Ex.: convidar para a mentoria de reta final"
      />

      {(pending || output) && (
        <div className="mt-4 rounded-lg border border-line bg-surface-2/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-700">{title}</span>
            {output && (
              <button
                className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800"
                onClick={() => navigator.clipboard.writeText(output)}
              >
                <Copy className="h-3 w-3" /> copiar
              </button>
            )}
          </div>
          {pending ? (
            <div className="flex items-center gap-2 py-4 text-sm text-ink-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Analisando o histórico…
            </div>
          ) : (
            <Markdown content={output} />
          )}
        </div>
      )}
    </div>
  );
}
