import Link from 'next/link';
import { Card, HealthBadge, PageHeader, SectionTitle } from '@/components/ui';
import { FunnelChart } from '@/components/charts';
import { stageFunnel } from '@/server/journey-service';
import { listStudents } from '@/server/student-service';
import { JOURNEY_STAGES, STAGE_CHECKLISTS, STAGE_DESCRIPTIONS, STAGE_LABELS } from '@/lib/constants';
import { num } from '@/lib/format';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { JourneyKanban } from './kanban';

export const dynamic = 'force-dynamic';

export default async function JourneyPage({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string }>;
}) {
  const { etapa } = await searchParams;
  const funnel = await stageFunnel();
  const busiest = [...funnel].sort((a, b) => b.total - a.total)[0]?.stage ?? 'ONBOARDING';
  const selected = (etapa as (typeof JOURNEY_STAGES)[number]) ?? busiest;
  const { rows } = await listStudents({ stage: [selected], limit: 60, orderBy: 'health' });

  // Quadro: todos os alunos ativos, distribuídos pelas onze colunas.
  const [{ rows: todos }, session] = await Promise.all([
    listStudents({ limit: 500, orderBy: 'health' }),
    getSession(),
  ]);
  const cartoes = todos.map(({ student, course }) => ({
    id: student.id,
    nome: student.name,
    etapa: student.stage,
    healthScore: student.healthScore,
    healthBand: student.healthBand as string,
    diasSemAcesso: student.daysWithoutAccess,
    curso: course ?? null,
  }));

  const total = funnel.reduce((s, f) => s + f.total, 0);

  return (
    <>
      <PageHeader
        title="Jornada do aluno"
        subtitle="Onze etapas, do primeiro contato ao embaixador. Cada etapa tem um checklist próprio."
      />

      <Card className="mb-4">
        <SectionTitle
          title="Quadro da jornada"
          description="Cada coluna é uma etapa. Arraste o aluno para movê-lo — a mudança vale na hora."
        />
        <JourneyKanban alunos={cartoes} podeMover={can(session?.role, 'aluno.edit')} />
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle
            title="Funil da jornada"
            description={`${num(total)} alunos ativos distribuídos nas etapas.`}
          />
          <FunnelChart data={funnel} />
        </Card>

        <Card>
          <SectionTitle title="Etapas" description="Clique para ver os alunos de cada etapa." />
          <ul className="space-y-1">
            {funnel.map((f) => (
              <li key={f.stage}>
                <Link
                  href={`/jornada?etapa=${f.stage}`}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                    selected === f.stage
                      ? 'bg-brand-50 font-medium text-brand-700'
                      : 'text-ink-700 hover:bg-surface-2'
                  }`}
                >
                  <span className="flex-1">{STAGE_LABELS[f.stage]}</span>
                  <span className="tabular-nums text-ink-500">{f.total}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-3">
        <Card>
          <SectionTitle
            title={`Checklist — ${STAGE_LABELS[selected]}`}
            description={STAGE_DESCRIPTIONS[selected]}
          />
          <ul className="space-y-2">
            {STAGE_CHECKLISTS[selected].map((item) => (
              <li key={item} className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle
            title={`Alunos na etapa “${STAGE_LABELS[selected]}”`}
            description={`${rows.length} aluno(s) nesta etapa.`}
          />
          <div className="table-wrap">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-surface-2/60">
                <tr>
                  <th className="th">Aluno</th>
                  <th className="th">Health Score</th>
                  <th className="th">Progresso</th>
                  <th className="th">Onboarding</th>
                  <th className="th">Sem acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ student }) => (
                  <tr key={student.id} className="row-hover">
                    <td className="td">
                      <Link href={`/alunos/${student.id}`} className="font-medium text-ink-900">
                        {student.name}
                      </Link>
                    </td>
                    <td className="td">
                      <HealthBadge band={student.healthBand} score={student.healthScore} size="sm" />
                    </td>
                    <td className="td">{Math.round(student.progressPercent)}%</td>
                    <td className="td">{Math.round(student.onboardingPercent)}%</td>
                    <td className="td">{student.daysWithoutAccess} dias</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-500">
                      Nenhum aluno nesta etapa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
