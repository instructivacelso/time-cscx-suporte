import Link from 'next/link';
import { Avatar, Card, HealthBadge, KpiCard, PageHeader, SectionTitle, StatusBadge } from '@/components/ui';
import { listActionPlans, planTasks } from '@/server/action-plan-service';
import { closePlanAction, updateTaskStatusAction } from '@/app/actions';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ActionPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const seeAll = can(session?.role, 'carteira.viewAll');

  const plans = await listActionPlans({
    status: sp.status ? [sp.status] : undefined,
    ownerId: seeAll ? undefined : session?.id,
  });

  const withTasks = await Promise.all(
    plans.slice(0, 40).map(async (p) => ({ ...p, tasks: await planTasks(p.plan.id) })),
  );

  const abertos = plans.filter((p) => p.plan.status === 'ABERTO' || p.plan.status === 'EM_EXECUCAO').length;
  const concluidos = plans.filter((p) => p.plan.status === 'CONCLUIDO').length;
  const semSucesso = plans.filter((p) => p.plan.status === 'SEM_SUCESSO').length;
  const taxa = concluidos + semSucesso ? Math.round((concluidos / (concluidos + semSucesso)) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Planos de ação"
        subtitle="Abertos automaticamente sempre que um aluno entra em risco — com checklist, prazo e responsável."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Em andamento" value={num(abertos)} accent="amber" />
        <KpiCard label="Recuperados" value={num(concluidos)} accent="green" />
        <KpiCard label="Sem sucesso" value={num(semSucesso)} accent="red" />
        <KpiCard label="Taxa de recuperação" value={`${taxa}%`} accent="brand" />
      </div>

      <Card className="mb-4 mt-5">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <select name="status" defaultValue={sp.status ?? ''} className="input max-w-xs">
            <option value="">Todos os status</option>
            {['ABERTO', 'EM_EXECUCAO', 'CONCLUIDO', 'SEM_SUCESSO', 'CANCELADO'].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
          <button className="btn-primary" type="submit">
            Filtrar
          </button>
          <Link href="/planos-acao" className="btn-ghost">
            Limpar
          </Link>
        </form>
      </Card>

      <div className="space-y-4">
        {withTasks.map(({ plan, student, owner, tasks }) => (
          <Card key={plan.id}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={plan.status} />
              <Link
                href={`/alunos/${student.id}?tab=planos`}
                className="text-sm font-semibold text-ink-900 hover:text-brand-700"
              >
                {student.name}
              </Link>
              <HealthBadge band={student.healthBand} score={student.healthScore} size="sm" />
              <span className="text-xs text-ink-500">risco {student.churnRisk}%</span>
              {owner?.name && (
                <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-500">
                  <Avatar name={owner.name} color={owner.avatarColor ?? '#8593ac'} size={20} />
                  {owner.name}
                </span>
              )}
            </div>

            <p className="mt-2 text-sm font-medium text-ink-900">{plan.title}</p>
            <p className="text-xs text-ink-600">
              <strong>Motivo:</strong> {plan.reason}
            </p>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <p className="label mb-1">Estratégia</p>
                <pre className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-sans text-xs text-ink-700">
                  {plan.strategy}
                </pre>
              </div>

              <div>
                <p className="label mb-1">Checklist</p>
                <ul className="space-y-1.5">
                  {tasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5"
                    >
                      <span className="flex-1 text-xs text-ink-700">{t.title}</span>
                      <span className="text-[11px] text-ink-400">{formatDate(t.dueAt)}</span>
                      {t.status === 'CONCLUIDA' ? (
                        <StatusBadge status={t.status} />
                      ) : (
                        <form action={updateTaskStatusAction}>
                          <input type="hidden" name="taskId" value={t.id} />
                          <input type="hidden" name="status" value="CONCLUIDA" />
                          <button className="text-[11px] font-medium text-brand-600 hover:underline">
                            concluir
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                  {tasks.length === 0 && <li className="text-xs text-ink-500">Sem tarefas.</li>}
                </ul>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <span className="text-[11px] text-ink-400">
                prazo {formatDate(plan.dueAt)} · criado {formatDate(plan.createdAt)}
                {plan.generatedByAi ? ' · gerado por IA' : ''}
              </span>
              {plan.status !== 'CONCLUIDO' && plan.status !== 'SEM_SUCESSO' && can(session?.role, 'planoAcao.manage') && (
                <form action={closePlanAction} className="ml-auto flex items-center gap-2">
                  <input type="hidden" name="planId" value={plan.id} />
                  <input
                    name="outcome"
                    className="input py-1 text-xs"
                    placeholder="Desfecho do plano"
                  />
                  <button name="success" value="true" className="btn-subtle px-2.5 py-1 text-xs">
                    Recuperado
                  </button>
                  <button name="success" value="false" className="btn-ghost px-2.5 py-1 text-xs">
                    Sem sucesso
                  </button>
                </form>
              )}
              {plan.outcome && <span className="text-xs text-ink-600">Desfecho: {plan.outcome}</span>}
            </div>
          </Card>
        ))}

        {plans.length === 0 && (
          <Card>
            <p className="py-10 text-center text-sm text-ink-500">Nenhum plano de ação neste filtro.</p>
          </Card>
        )}
      </div>
    </>
  );
}
