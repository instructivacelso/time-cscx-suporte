'use client';

import { useState, useTransition } from 'react';
import { Check, ChevronDown, Loader2, MessageCircle } from 'lucide-react';
import { logWhatsappContactAction } from '@/app/actions';

/**
 * Botão "Chamar no WhatsApp".
 *
 * Abre a conversa com o aluno no WhatsApp (app ou Web) com a mensagem já
 * escrita, e registra o contato no histórico do CSCX — assim o Health Score
 * enxerga o relacionamento, e a equipe vê quem já foi abordado.
 *
 * Não depende da API oficial do WhatsApp: usa o link wa.me, que funciona com
 * o número pessoal ou comercial de quem estiver usando o sistema.
 */

/** Deixa o telefone no formato que o WhatsApp espera: só dígitos, com o 55. */
export function normalizarTelefone(bruto: string) {
  const digitos = bruto.replace(/\D/g, '');
  if (!digitos) return null;
  if (digitos.startsWith('55')) return digitos;
  // 10 ou 11 dígitos = número brasileiro sem o código do país
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos;
}

export interface ModeloMensagem {
  chave: string;
  titulo: string;
  texto: string;
}

export function WhatsappButton({
  studentId,
  nome,
  telefone,
  modelos,
}: {
  studentId: string;
  nome: string;
  telefone: string | null;
  modelos: ModeloMensagem[];
}) {
  const [aberto, setAberto] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [pending, start] = useTransition();

  const numero = telefone ? normalizarTelefone(telefone) : null;

  if (!numero) {
    return (
      <button
        className="btn-ghost opacity-50"
        disabled
        title="Este aluno não tem telefone cadastrado."
      >
        <MessageCircle className="h-4 w-4" /> Sem telefone
      </button>
    );
  }

  function abrir(modelo: ModeloMensagem) {
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(modelo.texto)}`;
    // Abre antes de registrar: o navegador só permite abrir aba nova durante o clique.
    window.open(url, '_blank', 'noopener,noreferrer');
    setAberto(false);

    start(async () => {
      await logWhatsappContactAction({ studentId, assunto: modelo.titulo, conteudo: modelo.texto });
      setEnviado(true);
      setTimeout(() => setEnviado(false), 4000);
    });
  }

  const primeiro = modelos[0];

  return (
    <div className="relative">
      <div className="flex">
        <button
          className="btn-primary rounded-r-none"
          onClick={() => abrir(primeiro)}
          disabled={pending}
          title={`Abrir conversa com ${nome} no WhatsApp`}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : enviado ? (
            <Check className="h-4 w-4" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
          {enviado ? 'Contato registrado' : 'Chamar no WhatsApp'}
        </button>
        <button
          className="btn-primary rounded-l-none border-l border-white/20 px-2"
          onClick={() => setAberto((v) => !v)}
          aria-label="Escolher a mensagem"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {aberto && (
        <>
          <button
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Fechar"
            onClick={() => setAberto(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            <p className="border-b border-line px-3 py-2 text-xs font-medium text-ink-500">
              Escolha a mensagem
            </p>
            <ul className="max-h-80 overflow-auto">
              {modelos.map((m) => (
                <li key={m.chave}>
                  <button
                    className="w-full px-3 py-2.5 text-left transition hover:bg-surface-2"
                    onClick={() => abrir(m)}
                  >
                    <span className="block text-sm font-medium text-ink-900">{m.titulo}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-ink-500">{m.texto}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-3 py-2 text-[11px] leading-relaxed text-ink-400">
              A conversa abre no WhatsApp com o texto pronto — você revisa e envia. O contato fica
              registrado no histórico do aluno.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
