import Link from 'next/link';
import { eq, desc } from 'drizzle-orm';
import {
  Award,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  MessageSquare,
  Target,
  Trophy,
} from 'lucide-react';
import { Badge, Card, KpiCard, PageHeader, Progress, SectionTitle } from '@/components/ui';
import { StudyChart } from '@/components/charts';
import { db } from '@/db';
import { students } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { getStudent360, studySummary } from '@/server/student-service';
import { STAGE_LABELS, JOURNEY_STAGES } from '@/lib/constants';
import { formatDate, relativeDays } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  const session = await getSession();

  const studentId =
    session?.studentId ??
    (await db.select({ id: students.id }).from(students).orderBy(desc(students.createdAt)).limit(1))[0]
      ?.id;

  const s = studentId ? await getStudent360(studentId) : null;

  if (!s) {
    return (
      <Card>
        <p className="py-10 text-center text-sm text-ink-500">
          Nenhum aluno vinculado a esta conta.
        </p>
      </Card>
    );
  }

  const study = studySummary(s);
  const stageIdx = JOURNEY_STAGES.indexOf(s.student.stage);
  const pendingSurveys = s.surveys.filter((v) => v.status !== 'RESPONDIDA');
  const certificados = s.enrollments.filter((e) => e.enrollment.certificateIssuedAt);

  return (
    <>
      <PageHeader
        title={`Olá, ${s.student.name.split(' ')[0]}!`}
        subtitle={`Você está na etapa "${STAGE_LABELS[s.student.stage]}" da sua jornada.`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Progresso do curso"
          value={`${Math.round(s.student.progressPercent)}%`}
          accent="brand"
          icon={<Target className="h-4 w-4" />}
        />
        <KpiCard
          label="Horas estudadas"
          value={`${study.horasTotais}h`}
          hint={`${study.horas30}h nos últimos 30 dias`}
          accent="green"
          icon={<Clock className="h-4 w-4" />}
        />
        <KpiCard
          label="Dias ativos (30d)"
          value={study.diasAtivos30}
          accent="amber"
          icon={<Flame className="h-4 w-4" />}
        />
        <KpiCard
          label="Certificados"
          value={certificados.length}
          accent="violet"
          icon={<Trophy className="h-4 w-4" />}
        />
      </div>

      {pendingSurveys.length > 0 && (
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-sm font-medium text-brand-900">
            Você tem {pendingSurveys.length} pesquisa(s) aguardando resposta.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingSurveys.slice(0, 3).map((v) => (
              <Link key={v.id} href={`/pesquisa/${v.id}`} className="btn-primary px-3 py-1.5 text-xs">
                Responder {v.type} · {v.trigger.toLowerCase()}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Minha evolução" description="Horas de estudo por dia." />
          <StudyChart data={s.activities} />
        </Card>

        <Card>
          <SectionTitle title="Minhas metas" />
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-ink-700">Meta semanal</span>
                <span className="text-xs text-ink-500">{s.student.weeklyGoalHours}h</span>
              </div>
              <Progress value={study.aderenciaSemanal} tone="green" showLabel />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-ink-700">Progresso do curso</span>
                <span className="text-xs text-ink-500">
                  {Math.round(s.student.progressPercent)}%
                </span>
              </div>
              <Progress value={s.student.progressPercent} showLabel />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-ink-700">Onboarding</span>
                <span className="text-xs text-ink-500">
                  {Math.round(s.student.onboardingPercent)}%
                </span>
              </div>
              <Progress value={s.student.onboardingPercent} tone="amber" showLabel />
            </div>
            <div className="rounded-lg bg-surface-2 p-3 text-xs text-ink-600">
              <CalendarCheck className="mb-1 h-4 w-4 text-brand-600" />
              Previsão de conclusão: <strong>{formatDate(study.previsaoConclusao)}</strong>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Meus cursos" />
          <div className="space-y-3">
            {s.enrollments.map(({ enrollment, course }) => (
              <div key={enrollment.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink-900">{course?.name}</span>
                  {enrollment.certificateIssuedAt ? (
                    <Badge tone="green">
                      <Award className="h-3 w-3" /> certificado emitido
                    </Badge>
                  ) : (
                    <Badge tone="brand">{enrollment.status.toLowerCase()}</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  Módulo atual: {enrollment.currentModule ?? '—'} · atividades{' '}
                  {enrollment.activitiesDone}/{enrollment.activitiesTotal}
                  {enrollment.gradeAverage ? ` · média ${enrollment.gradeAverage}` : ''}
                </p>
                <Progress className="mt-2" value={enrollment.progressPercent} showLabel />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Minha jornada" />
          <ol className="relative ml-2 border-l border-line">
            {JOURNEY_STAGES.map((stage, i) => (
              <li key={stage} className="mb-2.5 ml-4">
                <span
                  className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ring-4 ring-surface ${
                    i < stageIdx ? 'bg-emerald-500' : i === stageIdx ? 'bg-brand-600' : 'bg-ink-300'
                  }`}
                />
                <span
                  className={`text-sm ${
                    i === stageIdx
                      ? 'font-semibold text-brand-700'
                      : i < stageIdx
                        ? 'text-ink-600'
                        : 'text-ink-400'
                  }`}
                >
                  {STAGE_LABELS[stage]}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Meu checklist de entrada" />
          <ul className="space-y-1.5">
            {s.onboarding.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 text-ink-300" />
                )}
                <span className={item.done ? 'text-ink-500 line-through' : 'text-ink-800'}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle
            title="Mensagens recentes"
            action={
              <Link href="/portal/mensagens" className="text-xs font-medium text-brand-600 hover:underline">
                ver todas
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {s.interactions.slice(0, 5).map((i) => (
              <li key={i.id} className="py-2.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-ink-400" />
                  <span className="flex-1 truncate text-sm text-ink-800">{i.subject}</span>
                  <span className="text-[11px] text-ink-400">{relativeDays(i.createdAt)}</span>
                </div>
              </li>
            ))}
            {s.interactions.length === 0 && (
              <li className="py-4 text-center text-sm text-ink-500">Nenhuma mensagem ainda.</li>
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}
