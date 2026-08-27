import { cn } from '@/lib/format';
import { HEALTH_BAND_VAR } from '@/lib/constants';
import type { HealthResult } from '@/lib/health-score';
import { INDICATOR_DESCRIPTIONS } from '@/lib/health-score';

export function HealthBreakdown({ result }: { result: HealthResult }) {
  const color = `rgb(var(${HEALTH_BAND_VAR[result.band]}))`;
  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <div
          className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(${color} ${result.score * 3.6}deg, #eceef2 0deg)`,
          }}
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-surface text-xl font-semibold text-ink-950">
            {result.score}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-ink-700">{result.summary}</p>
          <p className="mt-1 text-xs text-ink-500">
            Risco de evasão estimado: <strong className="text-ink-800">{result.churnRisk}%</strong>
          </p>
        </div>
      </div>

      <ul className="divide-y divide-line">
        {result.breakdown.map((b) => (
          <li key={b.key} className="py-2.5">
            <div className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-sm font-medium text-ink-800">{b.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className={cn(
                    'h-full rounded-full',
                    b.status === 'bom'
                      ? 'bg-emerald-500'
                      : b.status === 'medio'
                        ? 'bg-amber-500'
                        : 'bg-rose-500',
                  )}
                  style={{ width: `${b.rawScore}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-sm tabular-nums text-ink-700">
                {b.rawScore}
              </span>
              <span className="w-24 shrink-0 text-right text-xs text-ink-500">
                peso {b.weight} → +{b.weightedScore}
              </span>
            </div>
            <p className="mt-1 pl-[10.75rem] text-xs text-ink-500">{b.reason}</p>
            <p className="pl-[10.75rem] text-[11px] text-ink-400">{INDICATOR_DESCRIPTIONS[b.key]}</p>
          </li>
        ))}
      </ul>

      <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
        Os pesos definidos pela escola somam {result.breakdown.reduce((s, b) => s + b.weight, 0)}{' '}
        pontos. O motor normaliza esses pesos para a escala de 0 a 100 — a coluna “+valor” já mostra
        a contribuição real de cada indicador na nota final.
      </p>
    </div>
  );
}
