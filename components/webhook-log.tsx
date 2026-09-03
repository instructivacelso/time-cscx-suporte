'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface WebhookRow {
  id: string;
  source: string;
  eventType: string | null;
  email: string | null;
  status: string;
  message: string | null;
  payload: unknown;
  recebidoEm: string;
}

const TOM: Record<string, string> = {
  PROCESSADO: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  IGNORADO: 'border-line bg-surface-2 text-ink-500',
  ERRO: 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

/**
 * Lista os últimos webhooks recebidos, com o corpo bruto que a plataforma
 * mandou. É o que permite conferir o formato real e ajustar o mapeamento
 * quando algum campo vier com outro nome.
 */
export function WebhookLog({ rows }: { rows: WebhookRow[] }) {
  const [aberto, setAberto] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        Nenhum webhook recebido ainda. Assim que a Cademí disparar o primeiro evento, ele aparece
        aqui com o conteúdo completo.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className="py-2.5">
          <button
            className="flex w-full items-start gap-2 text-left"
            onClick={() => setAberto(aberto === r.id ? null : r.id)}
          >
            {aberto === r.id ? (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            ) : (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className={`chip border ${TOM[r.status] ?? TOM.IGNORADO}`}>{r.status.toLowerCase()}</span>
                <span className="text-sm font-medium text-ink-900">{r.eventType ?? 'evento sem nome'}</span>
                <span className="text-xs text-ink-500">{r.email ?? 'sem e-mail'}</span>
              </span>
              {r.message && <span className="mt-0.5 block text-xs text-ink-600">{r.message}</span>}
            </span>
            <span className="shrink-0 text-[11px] text-ink-400">{r.recebidoEm}</span>
          </button>

          {aberto === r.id && (
            <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-surface-2 p-3 text-[11px] leading-relaxed text-ink-700">
              {JSON.stringify(r.payload, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}
