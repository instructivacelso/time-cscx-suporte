'use client';

import { useState, useTransition } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { deleteUserAction, updateUserAction } from '@/app/actions';
import { ROLE_LABELS } from '@/lib/constants';

export interface UsuarioEditavel {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
}

/**
 * Editar e excluir um usuário da equipe.
 * A exclusão pede confirmação e explica o que acontece com o que estava no
 * nome da pessoa — nada é apagado junto, só fica sem responsável.
 */
export function UserActions({ usuario, souEu }: { usuario: UsuarioEditavel; souEu: boolean }) {
  const [modo, setModo] = useState<'fechado' | 'editar' | 'excluir'>('fechado');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function salvar(formData: FormData) {
    setErro(null);
    start(async () => {
      const r = await updateUserAction(formData);
      if (r?.ok) setModo('fechado');
      else setErro(r?.error ?? 'Não consegui salvar.');
    });
  }

  function excluir() {
    setErro(null);
    start(async () => {
      const fd = new FormData();
      fd.set('userId', usuario.id);
      const r = await deleteUserAction(fd);
      if (r?.ok) setModo('fechado');
      else setErro(r?.error ?? 'Não consegui excluir.');
    });
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          className="rounded-lg p-1.5 text-ink-500 transition hover:bg-surface-2 hover:text-ink-900"
          onClick={() => { setErro(null); setModo('editar'); }}
          aria-label={`Editar ${usuario.name}`}
          title="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          className="rounded-lg p-1.5 text-ink-500 transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40"
          onClick={() => { setErro(null); setModo('excluir'); }}
          disabled={souEu}
          aria-label={`Excluir ${usuario.name}`}
          title={souEu ? 'Você não pode excluir a própria conta' : 'Excluir'}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {modo !== 'fechado' && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
            {modo === 'editar' ? (
              <>
                <h2 className="text-base font-semibold text-ink-900">Editar usuário</h2>
                <p className="mt-1 text-xs text-ink-500">
                  Deixe a senha em branco para mantê-la como está.
                </p>

                <form action={salvar} className="mt-4 space-y-2">
                  <input type="hidden" name="userId" value={usuario.id} />
                  <label className="label" htmlFor={`nome-${usuario.id}`}>Nome</label>
                  <input id={`nome-${usuario.id}`} name="name" className="input" defaultValue={usuario.name} required />

                  <label className="label pt-1" htmlFor={`email-${usuario.id}`}>E-mail</label>
                  <input id={`email-${usuario.id}`} name="email" type="email" className="input" defaultValue={usuario.email} required />

                  <label className="label pt-1" htmlFor={`perfil-${usuario.id}`}>Perfil de acesso</label>
                  <select id={`perfil-${usuario.id}`} name="role" className="input" defaultValue={usuario.role}>
                    {(['ADMIN', 'COORDENADOR', 'ANALISTA', 'ALUNO'] as const).map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>

                  <label className="label pt-1" htmlFor={`senha-${usuario.id}`}>Nova senha (opcional)</label>
                  <input
                    id={`senha-${usuario.id}`}
                    name="password"
                    type="password"
                    className="input"
                    placeholder="deixe em branco para não alterar"
                    minLength={6}
                    autoComplete="new-password"
                  />

                  <label className="label pt-1" htmlFor={`cor-${usuario.id}`}>Cor do avatar</label>
                  <input id={`cor-${usuario.id}`} name="avatarColor" type="color" className="input h-10" defaultValue={usuario.avatarColor} />

                  {erro && <p className="pt-1 text-sm text-rose-600 dark:text-rose-400">{erro}</p>}

                  <div className="flex justify-end gap-2 pt-3">
                    <button type="button" className="btn-ghost" onClick={() => setModo('fechado')} disabled={pending}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={pending}>
                      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-ink-900">
                  Excluir {usuario.name}?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  A conta é removida e a pessoa perde o acesso ao sistema. Os alunos, tarefas e
                  registros que estavam no nome dela <strong>não são apagados</strong> — apenas ficam
                  sem responsável, para você redistribuir.
                </p>
                <p className="mt-2 text-xs text-ink-500">
                  Se a ideia é só tirar o acesso temporariamente, prefira marcar a conta como
                  <strong> inativa</strong> na coluna Status.
                </p>

                {erro && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{erro}</p>}

                <div className="mt-4 flex justify-end gap-2">
                  <button className="btn-ghost" onClick={() => setModo('fechado')} disabled={pending}>
                    Cancelar
                  </button>
                  <button
                    className="btn-primary bg-rose-600 hover:bg-rose-700"
                    onClick={excluir}
                    disabled={pending}
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Excluir definitivamente
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
