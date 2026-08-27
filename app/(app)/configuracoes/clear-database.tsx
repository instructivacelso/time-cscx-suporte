'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, Eraser, Loader2 } from 'lucide-react';
import { clearDatabaseAction } from '@/app/actions';

/**
 * Zera a base — o caminho para sair dos dados de demonstração e começar a
 * operação real. Exige confirmação digitada, porque não tem volta.
 */
export function ClearDatabaseButton() {
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  function limpar() {
    setErro(null);
    start(async () => {
      const r = await clearDatabaseAction(texto);
      if (r.ok) {
        setPronto(true);
        setAberto(false);
        setTexto('');
      } else {
        setErro(r.error);
      }
    });
  }

  if (pronto) {
    return (
      <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
        Base zerada. Alunos, cursos, pesquisas e histórico foram apagados — as contas de
        acesso continuam as mesmas.
      </p>
    );
  }

  if (!aberto) {
    return (
      <button className="btn-ghost w-full" onClick={() => setAberto(true)}>
        <Eraser className="h-4 w-4" /> Limpar toda a base
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-3">
      <p className="flex gap-2 text-sm text-ink-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
        <span>
          Isso apaga <strong>todos os alunos, cursos, pesquisas, alertas, tarefas e
          histórico</strong>. As contas de acesso da equipe são preservadas. Não dá para
          desfazer.
        </span>
      </p>

      <label className="mt-3 block text-xs text-ink-600" htmlFor="confirmar-limpeza">
        Para confirmar, digite <strong>LIMPAR</strong>:
      </label>
      <input
        id="confirmar-limpeza"
        className="input mt-1"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="LIMPAR"
        autoComplete="off"
      />

      {erro && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{erro}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="btn-primary"
          onClick={limpar}
          disabled={pending || texto.trim().toUpperCase() !== 'LIMPAR'}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
          {pending ? 'Limpando…' : 'Apagar tudo'}
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            setAberto(false);
            setTexto('');
            setErro(null);
          }}
          disabled={pending}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
