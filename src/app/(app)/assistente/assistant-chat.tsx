'use client';

import { useRef, useState, useTransition } from 'react';
import { Bot, Loader2, Send, Sparkles, User } from 'lucide-react';
import { assistantAnalyzeAction, assistantChatAction } from '@/app/actions';
import { Markdown } from '@/components/markdown';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Quais alunos devo priorizar hoje e por quê?',
  'Escreva uma mensagem de resgate para quem está há 15 dias sem acessar.',
  'O que explica a queda do NPS neste trimestre?',
  'Sugira uma régua de reengajamento para alunos com progresso abaixo de 30%.',
];

export function AssistantChat({
  students,
  configured,
}: {
  students: { id: string; name: string }[];
  configured: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string>('');
  const [input, setInput] = useState('');
  const [pending, start] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  function send(text: string) {
    if (!text.trim() || pending) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    start(async () => {
      const res = await assistantChatAction({
        threadId,
        studentId: studentId || null,
        message: text,
      });
      setThreadId(res.threadId);
      setMessages((m) => [...m, { role: 'assistant', content: res.answer }]);
      requestAnimationFrame(() => boxRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }));
    });
  }

  function analyze(scope: 'NPS' | 'CSAT' | 'HEALTH' | 'GERAL') {
    setMessages((m) => [...m, { role: 'user', content: `Analisar indicadores de ${scope}` }]);
    start(async () => {
      const answer = await assistantAnalyzeAction(scope);
      setMessages((m) => [...m, { role: 'assistant', content: answer }]);
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      <div className="space-y-4">
        <div className="card card-pad">
          <label className="label">Aluno em foco (opcional)</label>
          <select
            className="input mt-1"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Nenhum — visão geral</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
            Ao escolher um aluno, todo o histórico dele — indicadores, alertas, pesquisas e
            interações — entra no contexto da conversa.
          </p>
        </div>

        <div className="card card-pad">
          <p className="label mb-2">Análises rápidas</p>
          <div className="space-y-1.5">
            {(
              [
                ['GERAL', 'Panorama da operação'],
                ['HEALTH', 'Health Score da base'],
                ['NPS', 'NPS e detratores'],
                ['CSAT', 'CSAT do atendimento'],
              ] as const
            ).map(([scope, label]) => (
              <button
                key={scope}
                onClick={() => analyze(scope)}
                disabled={pending}
                className="btn-ghost w-full justify-start text-xs"
              >
                <Sparkles className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {!configured && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            <strong>Modo simulado.</strong> Configure a variável <code>OPENAI_API_KEY</code> para
            respostas geradas por IA.
          </div>
        )}
      </div>

      <div className="card flex h-[70vh] flex-col xl:col-span-3">
        <div ref={boxRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <Bot className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium text-ink-900">Assistente CSCX</p>
              <p className="mt-1 max-w-sm text-xs text-ink-500">
                Pergunte sobre a carteira, peça um plano de recuperação, um resumo de aluno ou uma
                mensagem pronta para enviar.
              </p>
              <div className="mt-4 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg border border-line px-3 py-2 text-left text-xs text-ink-600 transition hover:border-brand-300 hover:bg-brand-50/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className="flex gap-3">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                  m.role === 'user' ? 'bg-surface-3 text-ink-600' : 'bg-brand-50 text-brand-600'
                }`}
              >
                {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                {m.role === 'user' ? (
                  <p className="text-sm text-ink-800">{m.content}</p>
                ) : (
                  <Markdown content={m.content} />
                )}
              </div>
            </div>
          ))}

          {pending && (
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
            </div>
          )}
        </div>

        <form
          className="flex items-end gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            className="input min-h-[44px] resize-none"
            rows={1}
            value={input}
            placeholder="Escreva sua pergunta…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <button className="btn-primary h-[44px]" type="submit" disabled={pending || !input.trim()}>
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
