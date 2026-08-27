import Link from 'next/link';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { Avatar, Badge, Card, KpiCard, PageHeader, SectionTitle, StatusBadge } from '@/components/ui';
import { db } from '@/db';
import { students, tasks, users } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, num } from '@/lib/format';
import { createTaskAction, updateTaskStatusAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ responsavel?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const seeAll = can(session?.role, 'carteira.viewAll');
  const ownerId = seeAll ? sp.responsavel || undefined : session?.id;

  const statusFilter = sp.status ? [sp.status] : ['ABERTA', 'EM_ANDAMENTO'];

  const [rows, team] = await Promise.all([
    db
      .select({
        task: tasks,
        student: { id: students.id, name: students.name },
        owner: { id: users.id, name: users.name, avatarColor: users.avatarColor },
      })
      .from(tasks)
      .leftJoin(students, eq(tasks.studentId, students.id))
      .leftJoin(users, eq(tasks.ownerId, users.id))
      .where(
        and(
          inArray(tasks.status, statusFilter as never),
          ownerId ? eq(tasks.ownerId, ownerId) : undefined,
        ),
      )
      .orderBy(asc(tasks.dueAt))
      .limit(300),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)),
  ]);

  const now = new Date();
  const atrasadas = rows.filter((r) => r.task.dueAt && r.task.dueAt < now).length;
  const hoje = rows.filter(
    (r) => r.task.dueAt && r.task.dueAt.toDateString() === now.toDateString(),
  ).length;
  const urgentes = rows.filter((r) => r.task.priority === 'URGENTE').length;

  return (
    <>
      <PageHeader title="Tarefas" subtitle="Fila de trabalho do time de Customer Success." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Abertas" value={num(rows.length)} />
        <KpiCard label="Vencem hoje" value={num(hoje)} accent="amber" />
        <KpiCard label="Em atraso" value={num(atrasadas)} accent="red" />
        <KpiCard label="Urgentes" value={num(urgentes)} accent="red" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-4">
        <Card>
          <SectionTitle title="Nova tarefa" />
          <form action={createTaskAction} className="space-y-2">
            <input name="title" className="input" placeholder="Título da tarefa" required />
            <textarea name="description" rows={3} className="input" placeholder="Detalhes" />
            <div className="grid grid-cols-2 gap-2">
              <select name="priority" className="input">
                {['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input name="dueAt" type="date" className="input" />
            </div>
            <select name="ownerId" defaultValue={session?.id} className="input">
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="btn-primary w-full" type="submit">
              Criar tarefa
            </button>
          </form>

          <div className="mt-4 border-t border-line pt-3">
            <form method="get" className="space-y-2">
              <select name="status" defaultValue={sp.status ?? ''} className="input">
                <option value="">Abertas e em andamento</option>
                <option value="ABERTA">Abertas</option>
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="CONCLUIDA">Concluídas</option>
              </select>
              {seeAll && (
                <select name="responsavel" defaultValue={sp.responsavel ?? ''} className="input">
                  <option value="">Todos os responsáveis</option>
                  {team.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              <button className="btn-ghost w-full" type="submit">
                Filtrar
              </button>
            </form>
          </div>
        </Card>

        <div className="xl:col-span-3">
          <div className="table-wrap">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-surface-2/60">
                <tr>
                  <th className="th">Tarefa</th>
                  <th className="th">Aluno</th>
                  <th className="th">Responsável</th>
                  <th className="th">Prioridade</th>
                  <th className="th">Prazo</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ task, student, owner }) => {
                  const late = task.dueAt && task.dueAt < now && task.status !== 'CONCLUIDA';
                  return (
                    <tr key={task.id} className="row-hover">
                      <td className="td max-w-[320px]">
                        <span className="block truncate font-medium text-ink-900">{task.title}</span>
                        {task.description && (
                          <span className="block max-w-[320px] truncate text-xs text-ink-500">
                            {task.description}
                          </span>
                        )}
                      </td>
                      <td className="td">
                        {student ? (
                          <Link href={`/alunos/${student.id}`} className="text-brand-600 hover:underline">
                            {student.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="td">
                        {owner?.name ? (
                          <span className="flex items-center gap-2">
                            <Avatar name={owner.name} color={owner.avatarColor ?? '#8593ac'} size={22} />
                            {owner.name.split(' ')[0]}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="td">
                        <Badge
                          tone={
                            task.priority === 'URGENTE'
                              ? 'red'
                              : task.priority === 'ALTA'
                                ? 'amber'
                                : 'ink'
                          }
                        >
                          {task.priority.toLowerCase()}
                        </Badge>
                      </td>
                      <td className={`td ${late ? 'font-medium text-rose-600 dark:text-rose-400' : ''}`}>
                        {formatDate(task.dueAt)}
                      </td>
                      <td className="td">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="td">
                        {task.status !== 'CONCLUIDA' && (
                          <div className="flex gap-2">
                            {task.status === 'ABERTA' && (
                              <form action={updateTaskStatusAction}>
                                <input type="hidden" name="taskId" value={task.id} />
                                <input type="hidden" name="status" value="EM_ANDAMENTO" />
                                <button className="text-xs text-brand-600 hover:underline">iniciar</button>
                              </form>
                            )}
                            <form action={updateTaskStatusAction}>
                              <input type="hidden" name="taskId" value={task.id} />
                              <input type="hidden" name="status" value="CONCLUIDA" />
                              <button className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">concluir</button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-500">
                      Nenhuma tarefa nesta visão.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
