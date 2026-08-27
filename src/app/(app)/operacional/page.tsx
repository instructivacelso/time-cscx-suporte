import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, ListTodo, Rocket, Users } from 'lucide-react';
import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';
import { Avatar, Badge, Card, HealthBadge, KpiCard, PageHeader, SectionTitle, SeverityBadge } from '@/components/ui';
import { getOperationalMetrics } from '@/server/metrics-service';
import { listStudents } from '@/server/student-service';
import { db } from '@/db';
import { alerts, students, tasks, users } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, num, relativeDays } from '@/lib/format';
import { ALERT_TYPE_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function OperationalPage() {
  const session = await getSession();
  const seeAll = can(session?.role, 'carteira.viewAll');
  const ownerId = seeAll ? undefined : session?.id;

  const [metrics, semAcesso, minhasTarefas, alertasCriticos] = await Promise.all([
    getOperationalMetrics(ownerId),
    listStudents({ ownerId, limit: 10, orderBy: 'health' }),
    db
      .select({ task: tasks, student: { id: students.id, name: students.name } })
      .from(tasks)
      .leftJoin(students, eq(tasks.studentId, students.id))
      .where(
        and(
          inArray(tasks.status, ['ABERTA', 'EM_ANDAMENTO']),
          ownerId ? eq(tasks.ownerId, ownerId) : undefined,
        ),
      )
      .orderBy(asc(tasks.dueAt))
      .limit(12),
    db
      .select({
        alert: alerts,
        student: { id: students.id, name: students.name, healthScore: students.healthScore, healthBand: students.healthBand },
        owner: { name: users.name, avatarColor: users.avatarColor },
      })
      .from(alerts)
      .innerJoin(students, eq(alerts.studentId, students.id))
      .leftJoin(users, eq(students.ownerId, users.id))
      .where(
        and(
          inArray(alerts.status, ['ABERTO', 'EM_TRATATIVA']),
          inArray(alerts.severity, ['ALTA', 'CRITICA']),
          ownerId ? eq(students.ownerId, ownerId) : undefined,
        ),
      )
      .orderBy(desc(alerts.createdAt))
      .limit(12),
  ]);

  const c = metrics.carteira;
  const overdue = await db
    .select({ n: tasks.id })
    .from(tasks)
    .where(and(inArray(tasks.status, ['ABERTA', 'EM_ANDAMENTO']), lt(tasks.dueAt, new Date())));

  return (
    <>
      <PageHeader
        title="Painel operacional"
        subtitle={
          seeAll
            ? 'Rotina do dia de toda a operação de CSCX.'
            : 'Rotina do dia da sua carteira de alunos.'
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Carteira" value={num(Number(c.total))} icon={<Users className="h-4 w-4" />} />
        <KpiCard
          label="Em risco"
          value={num(Number(c.risco))}
          accent="red"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <KpiCard label="Em atenção" value={num(Number(c.atencao))} accent="amber" />
        <KpiCard label="Saudáveis" value={num(Number(c.saudavel))} accent="green" icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiCard
          label="7+ dias sem acesso"
          value={num(Number(c.semAcesso7))}
          accent="red"
          icon={<Clock className="h-4 w-4" />}
        />
        <KpiCard
          label="Onboarding incompleto"
          value={num(Number(c.onboardingIncompleto))}
          accent="violet"
          icon={<Rocket className="h-4 w-4" />}
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle
            title="Alertas de alta prioridade"
            description="O que precisa de tratativa hoje."
            action={
              <Link href="/alertas" className="text-xs font-medium text-brand-600 hover:underline">
                ver todos
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {alertasCriticos.map(({ alert, student, owner }) => (
              <li key={alert.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={alert.severity} />
                  <Link
                    href={`/alunos/${student.id}`}
                    className="text-sm font-medium text-ink-900 hover:text-brand-700"
                  >
                    {student.name}
                  </Link>
                  <HealthBadge band={student.healthBand} score={student.healthScore} size="sm" />
                  <span className="ml-auto text-xs text-ink-400">{relativeDays(alert.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-ink-700">{alert.title}</p>
                <p className="text-xs text-ink-500">{alert.description}</p>
                {owner?.name && (
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-400">
                    <Avatar name={owner.name} color={owner.avatarColor ?? '#8593ac'} size={16} />
                    {owner.name}
                  </p>
                )}
              </li>
            ))}
            {alertasCriticos.length === 0 && (
              <li className="py-8 text-center text-sm text-ink-500">
                Nenhum alerta de alta prioridade. 👏
              </li>
            )}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle
              title="Minhas tarefas"
              description={`${overdue.length} em atraso na operação`}
              action={
                <Link href="/tarefas" className="text-xs font-medium text-brand-600 hover:underline">
                  ver todas
                </Link>
              }
            />
            <ul className="divide-y divide-line">
              {minhasTarefas.map(({ task, student }) => {
                const late = task.dueAt && task.dueAt < new Date();
                return (
                  <li key={task.id} className="py-2.5">
                    <div className="flex items-start gap-2">
                      <ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink-800">{task.title}</p>
                        <p className="text-[11px] text-ink-400">
                          {student?.name ? `${student.name} · ` : ''}
                          <span className={late ? 'font-medium text-rose-600 dark:text-rose-400' : ''}>
                            prazo {formatDate(task.dueAt)}
                          </span>
                        </p>
                      </div>
                      <Badge tone={task.priority === 'URGENTE' ? 'red' : task.priority === 'ALTA' ? 'amber' : 'ink'}>
                        {task.priority.toLowerCase()}
                      </Badge>
                    </div>
                  </li>
                );
              })}
              {minhasTarefas.length === 0 && (
                <li className="py-6 text-center text-sm text-ink-500">Nenhuma tarefa aberta.</li>
              )}
            </ul>
          </Card>

          <Card>
            <SectionTitle title="Prioridade de contato" description="Menores Health Scores da carteira." />
            <ul className="divide-y divide-line">
              {semAcesso.rows.slice(0, 8).map(({ student }) => (
                <li key={student.id}>
                  <Link
                    href={`/alunos/${student.id}`}
                    className="flex items-center gap-2.5 py-2.5 transition hover:bg-brand-50/40"
                  >
                    <Avatar name={student.name} color="#8593ac" size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink-900">{student.name}</p>
                      <p className="text-[11px] text-ink-500">
                        {student.daysWithoutAccess} dias sem acesso
                      </p>
                    </div>
                    <HealthBadge band={student.healthBand} score={student.healthScore} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <SectionTitle title="Alertas por severidade" />
          <ul className="space-y-2">
            {metrics.alerts.map((a) => (
              <li key={a.severity} className="flex items-center justify-between text-sm">
                <SeverityBadge severity={a.severity} />
                <span className="font-medium text-ink-900">{a.total}</span>
              </li>
            ))}
            {metrics.alerts.length === 0 && <li className="text-sm text-ink-500">Sem alertas abertos.</li>}
          </ul>
        </Card>

        <Card>
          <SectionTitle title="Tarefas por status" />
          <ul className="space-y-2">
            {metrics.tasks.map((t) => (
              <li key={t.status} className="flex items-center justify-between text-sm">
                <span className="text-ink-600">{t.status.replaceAll('_', ' ').toLowerCase()}</span>
                <span className="font-medium text-ink-900">{t.total}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle title="Mentorias (60 dias)" />
          <p className="text-2xl font-semibold text-ink-950">
            {Number(metrics.mentorias.presentes)}/{Number(metrics.mentorias.oferecidas)}
          </p>
          <p className="mt-1 text-xs text-ink-500">presenças confirmadas sobre convites enviados</p>
          <ul className="mt-3 space-y-2">
            {metrics.tickets.map((t) => (
              <li key={t.status} className="flex items-center justify-between text-sm">
                <span className="text-ink-600">tickets {t.status.replaceAll('_', ' ').toLowerCase()}</span>
                <span className="font-medium text-ink-900">{t.total}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
