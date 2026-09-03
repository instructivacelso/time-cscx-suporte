import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { Card, HealthBadge, KpiCard, PageHeader, Progress, SectionTitle } from '@/components/ui';
import { HealthDistributionChart } from '@/components/charts';
import { getHealthConfig, getHealthDistribution } from '@/server/health-service';
import { db } from '@/db';
import { students } from '@/db/schema';
import {
  DEFAULT_WEIGHTS,
  INDICATOR_DESCRIPTIONS,
  INDICATOR_LABELS,
  type HealthIndicatorKey,
} from '@/lib/health-score';
import { HEALTH_BAND_EMOJI, HEALTH_BAND_LABELS } from '@/lib/constants';
import { num } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function HealthScorePage() {
  const [{ weights, thresholds }, distribution, piores, melhores, media] = await Promise.all([
    getHealthConfig(),
    getHealthDistribution(),
    db.select().from(students).where(eq(students.active, true)).orderBy(students.healthScore).limit(10),
    db
      .select()
      .from(students)
      .where(eq(students.active, true))
      .orderBy(desc(students.healthScore))
      .limit(10),
    db
      .select({
        media: sql<number>`coalesce(avg(${students.healthScore}), 0)`,
        risco: sql<number>`coalesce(avg(${students.churnRisk}), 0)`,
        queda: sql<number>`count(*) filter (where ${students.previousHealth} is not null and ${students.healthScore} < ${students.previousHealth})::int`,
      })
      .from(students)
      .where(eq(students.active, true)),
  ]);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const keys = Object.keys(DEFAULT_WEIGHTS) as HealthIndicatorKey[];
  const m = media[0];

  return (
    <>
      <PageHeader
        title="Health Score"
        subtitle="Nove indicadores ponderados. A nota final é sempre de 0 a 100 e sempre explicada."
        actions={
          <Link href="/configuracoes" className="btn-ghost">
            Calibrar pesos
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Health Score médio" value={Math.round(Number(m.media))} accent="green" />
        <KpiCard label="Risco médio de evasão" value={`${Math.round(Number(m.risco))}%`} accent="red" />
        <KpiCard label="Alunos em queda" value={num(Number(m.queda))} accent="amber" />
        <KpiCard label="Soma dos pesos" value={totalWeight} hint="normalizada para 100" accent="ink" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card>
          <SectionTitle title="Distribuição" description="Alunos ativos por faixa." />
          <HealthDistributionChart data={distribution} />
          <ul className="mt-3 space-y-1.5 text-xs">
            {(
              [
                ['EXCELENTE', `${thresholds.EXCELENTE} a 100`],
                ['SAUDAVEL', `${thresholds.SAUDAVEL} a ${thresholds.EXCELENTE - 1}`],
                ['ATENCAO', `${thresholds.ATENCAO} a ${thresholds.SAUDAVEL - 1}`],
                ['RISCO', `${thresholds.RISCO} a ${thresholds.ATENCAO - 1}`],
                ['CRITICO', `0 a ${thresholds.RISCO - 1}`],
              ] as const
            ).map(([band, range]) => (
              <li key={band} className="flex items-center justify-between text-ink-600">
                <span>
                  {HEALTH_BAND_EMOJI[band]} {HEALTH_BAND_LABELS[band]}
                </span>
                <span className="tabular-nums">{range}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle
            title="Como a nota é composta"
            description={`Os pesos definidos pela escola somam ${totalWeight} pontos e são normalizados para a escala de 0 a 100.`}
          />
          <ul className="space-y-3">
            {keys.map((k) => {
              const w = weights[k] ?? 0;
              const normalized = (w / totalWeight) * 100;
              return (
                <li key={k}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-sm font-medium text-ink-900">{INDICATOR_LABELS[k]}</span>
                    <span className="text-xs text-ink-500">
                      peso {w} · {normalized.toFixed(1).replace('.', ',')}% da nota
                    </span>
                  </div>
                  <Progress value={(w / Math.max(...Object.values(weights))) * 100} />
                  <p className="mt-1 text-xs text-ink-500">{INDICATOR_DESCRIPTIONS[k]}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Precisam de atenção agora" description="Dez menores notas da base." />
          <ul className="divide-y divide-line">
            {piores.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/alunos/${s.id}?tab=health`}
                  className="flex items-center gap-3 py-2.5 transition hover:bg-brand-50/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink-900">{s.name}</span>
                    <span className="block text-xs text-ink-500">
                      risco {s.churnRisk}% · {s.daysWithoutAccess} dias sem acesso
                    </span>
                  </span>
                  <HealthBadge band={s.healthBand} score={s.healthScore} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle title="Alunos de referência" description="Dez maiores notas — candidatos a depoimento." />
          <ul className="divide-y divide-line">
            {melhores.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/alunos/${s.id}?tab=health`}
                  className="flex items-center gap-3 py-2.5 transition hover:bg-brand-50/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink-900">{s.name}</span>
                    <span className="block text-xs text-ink-500">
                      {Math.round(s.progressPercent)}% do curso · NPS {s.npsLast ?? '—'}
                    </span>
                  </span>
                  <HealthBadge band={s.healthBand} score={s.healthScore} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
