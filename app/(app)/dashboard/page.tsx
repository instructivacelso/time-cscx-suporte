import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Clock,
  GraduationCap,
  HeartPulse,
  Repeat,
  Star,
  TrendingDown,
  Users,
} from 'lucide-react';
import { Card, HealthBadge, KpiCard, PageHeader, SectionTitle } from '@/components/ui';
import {
  CourseChart,
  CsatDistributionChart,
  EngagementChart,
  FunnelChart,
  HealthDistributionChart,
  MonthlyEvolutionChart,
  NpsTrendChart,
} from '@/components/charts';
import { getDashboardBundle } from '@/server/metrics-service';
import { EmptyDatabaseNotice } from '@/components/empty-database';
import { getSession } from '@/lib/auth';
import { getHealthDistribution } from '@/server/health-service';
import { listStudents } from '@/server/student-service';
import { money, num, pct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [bundle, distribution, atRisk, session] = await Promise.all([
    getDashboardBundle(),
    getHealthDistribution(),
    listStudents({ onlyAtRisk: true, limit: 8, orderBy: 'risk' }),
    getSession(),
  ]);

  const m = bundle.metrics;
  const baseVazia = m.totalStudents === 0;

  return (
    <>
      <PageHeader
        title="Dashboard executivo"
        subtitle="Visão consolidada da operação de Customer Success e Customer Experience."
        actions={
          <Link href="/relatorios" className="btn-ghost">
            Relatórios <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      />

      {baseVazia && <EmptyDatabaseNotice isAdmin={session?.role === 'ADMIN'} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Alunos"
          value={num(m.totalStudents)}
          hint={`${num(m.activeStudents)} ativos`}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Em risco"
          value={num(m.atRiskStudents)}
          hint={`${pct(m.totalStudents ? (m.atRiskStudents / m.totalStudents) * 100 : 0)} da base`}
          accent="red"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <KpiCard
          label="Health Score médio"
          value={m.avgHealthScore}
          hint="de 0 a 100"
          accent="green"
          icon={<HeartPulse className="h-4 w-4" />}
        />
        <KpiCard
          label="NPS"
          value={m.nps}
          hint={`${num(m.npsTotal)} respostas`}
          accent="brand"
          icon={<Star className="h-4 w-4" />}
        />
        <KpiCard
          label="CSAT"
          value={`${m.csat.toFixed(2).replace('.', ',')}/5`}
          hint={`${num(m.csatTotal)} respostas`}
          accent="amber"
          icon={<Star className="h-4 w-4" />}
        />
        <KpiCard
          label="Taxa de conclusão"
          value={pct(m.completionRate, 1)}
          hint={`${num(m.certificatesIssued)} certificados`}
          accent="violet"
          icon={<GraduationCap className="h-4 w-4" />}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Churn"
          value={pct(m.churnRate, 1)}
          accent="red"
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <KpiCard
          label="Retenção"
          value={pct(m.retentionRate, 1)}
          accent="green"
          icon={<Repeat className="h-4 w-4" />}
        />
        <KpiCard
          label="Tempo médio de resposta"
          value={`${num(m.avgResponseMinutes)} min`}
          accent="ink"
          icon={<Clock className="h-4 w-4" />}
        />
        <KpiCard
          label="Receita por aluno"
          value={money(m.revenuePerStudent)}
          accent="brand"
          icon={<Banknote className="h-4 w-4" />}
        />
        <KpiCard
          label="Receita recorrente"
          value={money(m.mrr)}
          hint="MRR"
          accent="green"
          icon={<Banknote className="h-4 w-4" />}
        />
        <KpiCard
          label="Onboarding médio"
          value={pct(m.avgOnboarding)}
          accent="violet"
          icon={<BadgeCheck className="h-4 w-4" />}
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle
            title="Evolução mensal"
            description="Matrículas, conclusões e cancelamentos nos últimos 6 meses."
          />
          <MonthlyEvolutionChart data={bundle.evolution} />
        </Card>

        <Card>
          <SectionTitle title="Distribuição do Health Score" description="Alunos ativos por faixa." />
          <HealthDistributionChart data={distribution} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <SectionTitle title="NPS mensal" description="Promotores − detratores, em pontos." />
          <NpsTrendChart data={bundle.npsTrend} />
        </Card>

        <Card>
          <SectionTitle title="CSAT" description="Distribuição das avaliações de 1 a 5 estrelas." />
          <CsatDistributionChart data={bundle.csat.distribution} />
          <p className="mt-2 text-xs text-ink-500">
            {pct(bundle.csat.satisfactionRate)} das respostas com 4 ou 5 estrelas.
          </p>
        </Card>

        <Card>
          <SectionTitle title="Engajamento" description="Horas estudadas por dia (30 dias)." />
          <EngagementChart data={bundle.engagement} />
        </Card>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle title="Desempenho por curso" description="Volume de alunos e taxa de conclusão." />
          <CourseChart data={bundle.courses} />
        </Card>

        <Card>
          <SectionTitle
            title="Alunos com maior risco"
            description="Ordenados pela probabilidade de evasão."
            action={
              <Link href="/alunos?risco=1" className="text-xs font-medium text-brand-600 hover:underline">
                ver todos
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {atRisk.rows.map(({ student }) => (
              <li key={student.id}>
                <Link
                  href={`/alunos/${student.id}`}
                  className="flex items-center gap-3 py-2.5 transition hover:bg-brand-50/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink-900">{student.name}</div>
                    <div className="text-xs text-ink-500">
                      {student.daysWithoutAccess} dias sem acesso · risco {student.churnRisk}%
                    </div>
                  </div>
                  <HealthBadge band={student.healthBand} score={student.healthScore} size="sm" />
                </Link>
              </li>
            ))}
            {atRisk.rows.length === 0 && (
              <li className="py-6 text-center text-sm text-ink-500">Nenhum aluno em risco. 🎉</li>
            )}
          </ul>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <SectionTitle
            title="Funil da jornada"
            description="Quantidade de alunos em cada etapa, do primeiro contato ao embaixador."
          />
          <FunnelChart data={bundle.funnel} />
        </Card>
      </div>
    </>
  );
}
