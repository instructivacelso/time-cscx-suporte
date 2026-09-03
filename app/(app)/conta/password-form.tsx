'use client';

import { useState, useTransition } from 'react';
import { Check, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { changeMyPasswordAction } from '@/app/actions';

/** Troca da própria senha, exigindo a senha atual. */
export function PasswordForm() {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    start(async () => {
      const r = await changeMyPasswordAction({ senhaAtual: atual, novaSenha: nova, confirmacao });
      if (r.ok) {
        setOk(true);
        setAtual('');
        setNova('');
        setConfirmacao('');
      } else {
        setErro(r.error);
      }
    });
  }

  const campo = ver ? 'text' : 'password';

  return (
    <form onSubmit={enviar} className="space-y-2">
      <label className="label" htmlFor="senha-atual">Senha atual</label>
      <div className="relative">
        <input
          id="senha-atual"
          type={campo}
          className="input pr-10"
          value={atual}
          onChange={(e) => setAtual(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 transition hover:text-ink-700"
          onClick={() => setVer((v) => !v)}
          aria-label={ver ? 'Ocultar senhas' : 'Mostrar senhas'}
        >
          {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <label className="label pt-1" htmlFor="senha-nova">Nova senha</label>
      <input
        id="senha-nova"
        type={campo}
        className="input"
        value={nova}
        onChange={(e) => setNova(e.target.value)}
        minLength={6}
        autoComplete="new-password"
        required
      />

      <label className="label pt-1" htmlFor="senha-confirmacao">Repita a nova senha</label>
      <input
        id="senha-confirmacao"
        type={campo}
        className="input"
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
        minLength={6}
        autoComplete="new-password"
        required
      />

      {erro && <p className="pt-1 text-sm text-rose-600 dark:text-rose-400">{erro}</p>}
      {ok && (
        <p className="flex items-center gap-1.5 pt-1 text-sm text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" /> Senha alterada. Use a nova no próximo acesso.
        </p>
      )}

      <div className="pt-2">
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Alterar senha
        </button>
      </div>

      <p className="pt-1 text-xs text-ink-500">Mínimo de 6 caracteres.</p>
    </form>
  );
}
