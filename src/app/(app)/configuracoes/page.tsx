import { Card, PageHeader, SectionTitle } from '@/components/ui';
import { getHealthConfig } from '@/server/health-service';
import {
  DEFAULT_WEIGHTS,
  INDICATOR_DESCRIPTIONS,
  INDICATOR_LABELS,
  type HealthIndicatorKey,
} from '@/lib/health-score';
import { HEALTH_BAND_EMOJI, HEALTH_BAND_LABELS } from '@/lib/constants';
import { resetHealthConfigAction, saveHealthConfigAction } from '@/app/actions';
import { RoutineButton } from './routine-button';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { weights, thresholds } = await getHealthConfig();
  const keys = Object.keys(DEFAULT_WEIGHTS) as HealthIndicatorKey[];
  const total = keys.reduce((s, k) => s + (weights[k] ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Configuração do Health Score"
        subtitle="Calibre os pesos de cada indicador e as faixas de classificação."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle
            title="Pesos dos indicadores"
            description={`Soma atual: ${total} pontos. O motor normaliza automaticamente para a escala de 0 a 100, então a soma não precisa ser exatamente 100.`}
          />
          <form action={saveHealthConfigAction} className="space-y-4">
            <div className="space-y-3">
              {keys.map((k) => (
                <div key={k} className="grid gap-2 sm:grid-cols-[1fr_120px] sm:items-center">
                  <div>
                    <label className="text-sm font-medium text-ink-900" htmlFor={`w_${k}`}>
                      {INDICATOR_LABELS[k]}
                    </label>
                    <p className="text-xs text-ink-500">{INDICATOR_DESCRIPTIONS[k]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id={`w_${k}`}
                      name={`w_${k}`}
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={weights[k]}
                      className="input"
                    />
                    <span className="whitespace-nowrap text-xs text-ink-500">
                      {(((weights[k] ?? 0) / total) * 100).toFixed(1).replace('.', ',')}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-line pt-4">
              <p className="label mb-2">Faixas de classificação (nota mínima)</p>
              <div className="grid gap-3 sm:grid-cols-4">
                {(['EXCELENTE', 'SAUDAVEL', 'ATENCAO', 'RISCO'] as const).map((band) => (
                  <div key={band}>
                    <label className="text-xs text-ink-600" htmlFor={`t_${band}`}>
                      {HEALTH_BAND_EMOJI[band]} {HEALTH_BAND_LABELS[band]}
                    </label>
                    <input
                      id={`t_${band}`}
                      name={`t_${band}`}
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={thresholds[band]}
                      className="input mt-1"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-500">
                🔴 Crítico é tudo abaixo do valor definido para Risco.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" type="submit">
                Salvar configuração
              </button>
              <button className="btn-ghost" type="submit" formAction={resetHealthConfigAction}>
                Restaurar padrão da escola
              </button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle
              title="Rotina diária"
              description="Recalcula o Health Score de todos os alunos, reavalia alertas, atualiza a jornada, abre planos de recuperação e dispara automações."
            />
            <RoutineButton />
            <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
              Em produção, agende{' '}
              <code className="rounded bg-surface-3 px-1 py-0.5">POST /api/cron/rotina</code> uma vez
              por dia (Railway Cron ou serviço externo), enviando o cabeçalho{' '}
              <code className="rounded bg-surface-3 px-1 py-0.5">x-cron-key</code> com o valor de{' '}
              <code className="rounded bg-surface-3 px-1 py-0.5">CRON_SECRET</code>.
            </p>
          </Card>

          <Card>
            <SectionTitle title="Como a nota é calculada" />
            <ol className="space-y-2 text-xs text-ink-600">
              <li>1. Cada indicador recebe uma nota bruta de 0 a 100 a partir dos dados do aluno.</li>
              <li>
                2. O peso de cada indicador é convertido em percentual (peso ÷ soma dos pesos × 100).
              </li>
              <li>3. A nota final é a soma ponderada, sempre entre 0 e 100.</li>
              <li>4. A faixa é definida pelos limites acima.</li>
              <li>
                5. O risco de evasão combina a nota com sinais de alta correlação: dias sem acesso,
                inadimplência, NPS/CSAT baixos, atraso de cronograma e reclamações abertas.
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
