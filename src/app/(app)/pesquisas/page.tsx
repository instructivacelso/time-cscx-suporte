import Link from 'next/link';
import { Badge, Card, KpiCard, PageHeader, SectionTitle, StatusBadge } from '@/components/ui';
import { CsatDistributionChart, NpsTrendChart } from '@/components/charts';
import { getCsatSummary, getNpsSummary, getNpsTrend, listSurveys, NPS_QUESTION } from '@/server/survey-service';
import { formatDate, num, pct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const sp = await searchParams;
  const tipo = (sp.tipo as 'NPS' | 'CSAT' | undefined) ?? undefined;

  const [nps, nps90, csat, trend, rows] = await Promise.all([
    getNpsSummary(),
    getNpsSummary(90),
    getCsatSummary(),
    getNpsTrend(),
    listSurveys({ type: tipo, limit: 200 }),
  ]);

  const pendentes = rows.filter((r) => r.survey.status !== 'RESPONDIDA').length;
  const respostaRate = rows.length
    ? Math.round((rows.filter((r) => r.survey.status === 'RESPONDIDA').length / rows.length) * 100)
    : 0;

  return (
    <>
      <PageHeader
        title="NPS & CSAT"
        subtitle="NPS automático em D+30, D+60, D+90 e na conclusão. CSAT após atendimento, mentoria, onboarding e conclusão."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="NPS geral" value={nps.nps} hint={`${num(nps.total)} respostas`} accent="brand" />
        <KpiCard label="NPS 90 dias" value={nps90.nps} hint={`${num(nps90.total)} respostas`} accent="green" />
        <KpiCard label="Promotores" value={pct(nps.promoterPct)} accent="green" />
        <KpiCard label="Detratores" value={pct(nps.detractorPct)} accent="red" />
        <KpiCard label="CSAT médio" value={`${csat.average.toFixed(2).replace('.', ',')}/5`} accent="amber" />
        <KpiCard label="Taxa de resposta" value={`${respostaRate}%`} hint={`${num(pendentes)} pendentes`} accent="ink" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle title="Evolução do NPS" description={`Pergunta: "${NPS_QUESTION}"`} />
          <NpsTrendChart data={trend} />
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-emerald-500/10 p-3">
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{nps.promoters}</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Promotores (9–10)</p>
            </div>
            <div className="rounded-lg bg-surface-3 p-3">
              <p className="text-lg font-semibold text-ink-700">{nps.passives}</p>
              <p className="text-xs text-ink-600">Neutros (7–8)</p>
            </div>
            <div className="rounded-lg bg-rose-500/10 p-3">
              <p className="text-lg font-semibold text-rose-700 dark:text-rose-400">{nps.detractors}</p>
              <p className="text-xs text-rose-700 dark:text-rose-400">Detratores (0–6)</p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="CSAT" description="Distribuição de 1 a 5 estrelas." />
          <CsatDistributionChart data={csat.distribution} />
          <p className="mt-2 text-xs text-ink-500">
            {pct(csat.satisfactionRate)} das respostas com 4 ou 5 estrelas ({num(csat.total)} respostas).
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle
          title="Respostas"
          description="Todas as pesquisas enviadas pela plataforma."
          action={
            <div className="flex gap-1">
              {[
                { label: 'Todas', href: '/pesquisas' },
                { label: 'NPS', href: '/pesquisas?tipo=NPS' },
                { label: 'CSAT', href: '/pesquisas?tipo=CSAT' },
              ].map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`rounded-lg px-2.5 py-1 text-xs transition ${
                    (t.label === 'Todas' && !tipo) || t.label === tipo
                      ? 'bg-brand-50 font-medium text-brand-700'
                      : 'text-ink-500 hover:bg-surface-3'
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          }
        />
        <div className="table-wrap">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-surface-2/60">
              <tr>
                <th className="th">Aluno</th>
                <th className="th">Tipo</th>
                <th className="th">Gatilho</th>
                <th className="th">Nota</th>
                <th className="th">Classificação</th>
                <th className="th">Comentário</th>
                <th className="th">Status</th>
                <th className="th">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ survey, student }) => (
                <tr key={survey.id} className="row-hover">
                  <td className="td">
                    <Link href={`/alunos/${student.id}?tab=pesquisas`} className="font-medium text-ink-900">
                      {student.name}
                    </Link>
                  </td>
                  <td className="td">
                    <Badge tone={survey.type === 'NPS' ? 'brand' : 'violet'}>{survey.type}</Badge>
                  </td>
                  <td className="td text-ink-600">{survey.trigger}</td>
                  <td className="td font-medium">{survey.score ?? '—'}</td>
                  <td className="td">
                    {survey.npsClass ? (
                      <Badge
                        tone={
                          survey.npsClass === 'PROMOTOR'
                            ? 'green'
                            : survey.npsClass === 'NEUTRO'
                              ? 'ink'
                              : 'red'
                        }
                      >
                        {survey.npsClass.toLowerCase()}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="td max-w-[300px] truncate text-ink-600">{survey.comment ?? '—'}</td>
                  <td className="td">
                    <StatusBadge status={survey.status} />
                  </td>
                  <td className="td text-ink-500">{formatDate(survey.answeredAt ?? survey.createdAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-ink-500">
                    Nenhuma pesquisa registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
