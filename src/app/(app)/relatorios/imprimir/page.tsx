import { getDashboardBundle } from '@/server/metrics-service';
import { getHealthDistribution } from '@/server/health-service';
import { HEALTH_BAND_LABELS, STAGE_LABELS } from '@/lib/constants';
import { formatDate, money, num, pct } from '@/lib/format';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

export default async function PrintableReportPage() {
  const [bundle, distribution] = await Promise.all([getDashboardBundle(), getHealthDistribution()]);
  const m = bundle.metrics;

  const kpis: [string, string | number][] = [
    ['Total de alunos', num(m.totalStudents)],
    ['Alunos ativos', num(m.activeStudents)],
    ['Alunos em risco', num(m.atRiskStudents)],
    ['Health Score médio', m.avgHealthScore],
    ['Risco médio de evasão', pct(m.avgChurnRisk)],
    ['NPS', `${m.nps} (${num(m.npsTotal)} respostas)`],
    ['CSAT', `${m.csat.toFixed(2).replace('.', ',')}/5`],
    ['Taxa de conclusão', pct(m.completionRate, 1)],
    ['Churn', pct(m.churnRate, 1)],
    ['Retenção', pct(m.retentionRate, 1)],
    ['Tempo médio de resposta', `${num(m.avgResponseMinutes)} min`],
    ['Receita por aluno', money(m.revenuePerStudent)],
    ['Receita recorrente (MRR)', money(m.mrr)],
    ['Receita total', money(m.totalRevenue)],
    ['LTV médio', money(m.ltv)],
    ['Certificados emitidos', num(m.certificatesIssued)],
    ['Onboarding médio', pct(m.avgOnboarding)],
    ['Alertas abertos', num(m.openAlerts)],
  ];

  return (
    <main className="mx-auto max-w-4xl bg-surface p-8 text-ink-900 print:p-0">
      <PrintButton />

      <header className="mb-6 border-b border-line pb-4">
        <p className="text-xs uppercase tracking-wider text-ink-500">Escola Instructiva</p>
        <h1 className="text-2xl font-semibold">Relatório gerencial de Customer Success</h1>
        <p className="mt-1 text-sm text-ink-500">Gerado em {formatDate(new Date())}</p>
      </header>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-600">
          Indicadores consolidados
        </h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {kpis.map(([label, value], i) => (
              <tr key={label} className={i % 2 ? 'bg-surface-2' : ''}>
                <td className="border border-line px-3 py-1.5 text-ink-600">{label}</td>
                <td className="border border-line px-3 py-1.5 text-right font-medium">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-600">
          Distribuição do Health Score
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-3">
              <th className="border border-line px-3 py-1.5 text-left">Faixa</th>
              <th className="border border-line px-3 py-1.5 text-right">Alunos</th>
              <th className="border border-line px-3 py-1.5 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {(['EXCELENTE', 'SAUDAVEL', 'ATENCAO', 'RISCO', 'CRITICO'] as const).map((band) => {
              const total = distribution.find((d) => d.band === band)?.total ?? 0;
              return (
                <tr key={band}>
                  <td className="border border-line px-3 py-1.5">{HEALTH_BAND_LABELS[band]}</td>
                  <td className="border border-line px-3 py-1.5 text-right">{total}</td>
                  <td className="border border-line px-3 py-1.5 text-right">
                    {pct(m.activeStudents ? (total / m.activeStudents) * 100 : 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-600">
          Evolução mensal
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-3">
              <th className="border border-line px-3 py-1.5 text-left">Mês</th>
              <th className="border border-line px-3 py-1.5 text-right">Matrículas</th>
              <th className="border border-line px-3 py-1.5 text-right">Conclusões</th>
              <th className="border border-line px-3 py-1.5 text-right">Cancelamentos</th>
            </tr>
          </thead>
          <tbody>
            {bundle.evolution.map((e) => (
              <tr key={e.month}>
                <td className="border border-line px-3 py-1.5">{e.label}</td>
                <td className="border border-line px-3 py-1.5 text-right">{e.matriculas}</td>
                <td className="border border-line px-3 py-1.5 text-right">{e.conclusoes}</td>
                <td className="border border-line px-3 py-1.5 text-right">{e.cancelamentos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-600">
          Desempenho por curso
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-3">
              <th className="border border-line px-3 py-1.5 text-left">Curso</th>
              <th className="border border-line px-3 py-1.5 text-right">Alunos</th>
              <th className="border border-line px-3 py-1.5 text-right">Progresso</th>
              <th className="border border-line px-3 py-1.5 text-right">Conclusão</th>
              <th className="border border-line px-3 py-1.5 text-right">Health</th>
              <th className="border border-line px-3 py-1.5 text-right">Receita</th>
            </tr>
          </thead>
          <tbody>
            {bundle.courses.map((c) => (
              <tr key={c.courseId}>
                <td className="border border-line px-3 py-1.5">{c.course}</td>
                <td className="border border-line px-3 py-1.5 text-right">{c.alunos}</td>
                <td className="border border-line px-3 py-1.5 text-right">{pct(c.progresso)}</td>
                <td className="border border-line px-3 py-1.5 text-right">{pct(c.conclusao)}</td>
                <td className="border border-line px-3 py-1.5 text-right">{c.health}</td>
                <td className="border border-line px-3 py-1.5 text-right">{money(c.receita)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-600">
          Funil da jornada
        </h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {bundle.funnel.map((f, i) => (
              <tr key={f.stage} className={i % 2 ? 'bg-surface-2' : ''}>
                <td className="border border-line px-3 py-1.5">{STAGE_LABELS[f.stage]}</td>
                <td className="border border-line px-3 py-1.5 text-right font-medium">{f.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-8 border-t border-line pt-3 text-xs text-ink-400">
        CSCX — Customer Success &amp; Customer Experience · Escola Instructiva
      </footer>
    </main>
  );
}
