'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteScriptAction, saveScriptAction } from '@/app/actions';
import {
  CANAIS,
  CANAL_LABELS,
  SITUACOES,
  SITUACAO_LABELS,
  VARIAVEIS,
} from '@/lib/scripts';

export interface ScriptLinha {
  id: string;
  title: string;
  channel: string;
  situation: string;
  subject: string | null;
  content: string;
  order: number;
  active: boolean;
}

/**
 * Lista e edição dos scripts de mensagem.
 * O texto é escrito com variáveis entre chaves — {{nome}}, {{curso}} — que o
 * sistema troca pelo dado real do aluno na hora de usar.
 */
export function ScriptEditor({ scripts, podeEditar }: { scripts: ScriptLinha[]; podeEditar: boolean }) {
  const [editando, setEditando] = useState<ScriptLinha | 'novo' | null>(null);
  const [excluindo, setExcluindo] = useState<ScriptLinha | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const porCanal = CANAIS.map((canal) => ({
    canal,
    itens: scripts.filter((s) => s.channel === canal),
  })).filter((g) => g.itens.length > 0 || g.canal === 'WHATSAPP');

  function salvar(formData: FormData) {
    setErro(null);
    start(async () => {
      const r = await saveScriptAction(formData);
      if (r.ok) setEditando(null);
      else setErro(r.error);
    });
  }

  function excluir() {
    if (!excluindo) return;
    start(async () => {
      const fd = new FormData();
      fd.set('scriptId', excluindo.id);
      await deleteScriptAction(fd);
      setExcluindo(null);
    });
  }

  async function copiar(s: ScriptLinha) {
    try {
      await navigator.clipboard.writeText(s.content);
      setCopiado(s.id);
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      setErro('Não consegui copiar — seu navegador bloqueou o acesso à área de transferência.');
    }
  }

  const emEdicao = editando === 'novo' ? null : editando;

  return (
    <>
      {podeEditar && (
        <div className="mb-4">
          <button className="btn-primary" onClick={() => { setErro(null); setEditando('novo'); }}>
            <Plus className="h-4 w-4" /> Novo script
          </button>
        </div>
      )}

      {erro && !editando && (
        <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
          {erro}
        </p>
      )}

      <div className="space-y-5">
        {porCanal.map(({ canal, itens }) => (
          <div key={canal}>
            <h2 className="mb-2 text-sm font-semibold text-ink-900">{CANAL_LABELS[canal]}</h2>

            {itens.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-500">
                Nenhum script neste canal ainda.
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {itens.map((s) => (
                  <article
                    key={s.id}
                    className={`card card-pad ${s.active ? '' : 'opacity-60'}`}
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <h3 className="flex-1 text-sm font-semibold text-ink-900">{s.title}</h3>
                      <span className="chip border border-line bg-surface-2 text-ink-600">
                        {SITUACAO_LABELS[s.situation] ?? s.situation}
                      </span>
                      {!s.active && (
                        <span className="chip border border-line bg-surface-2 text-ink-500">inativo</span>
                      )}
                    </div>

                    {s.subject && (
                      <p className="mt-1.5 text-xs text-ink-500">
                        <strong className="font-medium text-ink-700">Assunto:</strong> {s.subject}
                      </p>
                    )}

                    <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-ink-700">
                      {s.content}
                    </pre>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => copiar(s)}>
                        {copiado === s.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiado === s.id ? 'Copiado' : 'Copiar'}
                      </button>
                      {podeEditar && (
                        <>
                          <button
                            className="btn-ghost px-2.5 py-1 text-xs"
                            onClick={() => { setErro(null); setEditando(s); }}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          <button
                            className="btn-ghost px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                            onClick={() => setExcluindo(s)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {editando && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl border border-line bg-surface p-5 shadow-xl">
            <h2 className="text-base font-semibold text-ink-900">
              {emEdicao ? 'Editar script' : 'Novo script'}
            </h2>

            <form action={salvar} className="mt-4 space-y-2">
              {emEdicao && <input type="hidden" name="scriptId" value={emEdicao.id} />}

              <label className="label" htmlFor="s-titulo">Título</label>
              <input
                id="s-titulo"
                name="title"
                className="input"
                defaultValue={emEdicao?.title ?? ''}
                placeholder="Ex.: Resgate — aluno parado"
                required
              />

              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="s-canal">Canal</label>
                  <select id="s-canal" name="channel" className="input" defaultValue={emEdicao?.channel ?? 'WHATSAPP'}>
                    {CANAIS.map((c) => (
                      <option key={c} value={c}>{CANAL_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="s-situacao">Situação</label>
                  <select id="s-situacao" name="situation" className="input" defaultValue={emEdicao?.situation ?? 'GERAL'}>
                    {SITUACOES.map((c) => (
                      <option key={c} value={c}>{SITUACAO_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="s-ordem">Ordem</label>
                  <input id="s-ordem" name="order" type="number" className="input" defaultValue={emEdicao?.order ?? 0} />
                </div>
              </div>

              <label className="label pt-1" htmlFor="s-assunto">Assunto (só para e-mail)</label>
              <input id="s-assunto" name="subject" className="input" defaultValue={emEdicao?.subject ?? ''} />

              <label className="label pt-1" htmlFor="s-conteudo">Mensagem</label>
              <textarea
                id="s-conteudo"
                name="content"
                className="input min-h-[180px] font-mono text-xs leading-relaxed"
                defaultValue={emEdicao?.content ?? ''}
                required
              />

              <div className="rounded-lg border border-line bg-surface-2 p-3">
                <p className="label mb-1.5">Variáveis disponíveis</p>
                <ul className="grid gap-x-4 gap-y-1 text-[11px] text-ink-600 sm:grid-cols-2">
                  {VARIAVEIS.map((v) => (
                    <li key={v.chave}>
                      <code className="rounded bg-surface-3 px-1 text-ink-800">{v.chave}</code> — {v.descricao}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-ink-500">
                  O sistema troca cada uma pelo dado real do aluno na hora de usar.
                </p>
              </div>

              <label className="flex items-center gap-2 pt-1 text-sm text-ink-700">
                <input type="checkbox" name="active" value="true" defaultChecked={emEdicao?.active ?? true} />
                Script ativo (aparece para a equipe usar)
              </label>
              <input type="hidden" name="active" value="false" />

              {erro && <p className="text-sm text-rose-600 dark:text-rose-400">{erro}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-ghost" onClick={() => setEditando(null)} disabled={pending}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar script
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {excluindo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
            <h2 className="text-base font-semibold text-ink-900">Excluir “{excluindo.title}”?</h2>
            <p className="mt-2 text-sm text-ink-600">
              O script sai da lista. As mensagens já enviadas com ele continuam no histórico dos alunos.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setExcluindo(null)} disabled={pending}>
                Cancelar
              </button>
              <button className="btn-primary bg-rose-600 hover:bg-rose-700" onClick={excluir} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
