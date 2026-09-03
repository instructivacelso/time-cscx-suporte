import { desc, eq, sql } from 'drizzle-orm';
import { Avatar, Badge, Card, KpiCard, PageHeader } from '@/components/ui';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { formatDateTime, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

const ACTION_TONE: Record<string, 'brand' | 'green' | 'amber' | 'red' | 'ink' | 'violet'> = {
  LOGIN: 'green',
  LOGOUT: 'ink',
  CREATE: 'brand',
  UPDATE: 'amber',
  DELETE: 'red',
  EXPORT: 'violet',
  RECALC: 'brand',
  RUN: 'violet',
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entidade?: string; acao?: string }>;
}) {
  const sp = await searchParams;

  const rows = await db
    .select({ log: auditLogs, user: { name: users.name, avatarColor: users.avatarColor } })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(
      sp.entidade
        ? eq(auditLogs.entity, sp.entidade)
        : sp.acao
          ? eq(auditLogs.action, sp.acao)
          : undefined,
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(400);

  const [totals] = await db.select({ n: sql<number>`count(*)::int` }).from(auditLogs);
  const hoje = rows.filter(
    (r) => r.log.createdAt.toDateString() === new Date().toDateString(),
  ).length;

  const entities = [...new Set(rows.map((r) => r.log.entity))];
  const actions = [...new Set(rows.map((r) => r.log.action))];

  return (
    <>
      <PageHeader
        title="Registro de auditoria"
        subtitle="Toda ação relevante executada no sistema, com autor, entidade e horário."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Registros" value={num(Number(totals.n))} />
        <KpiCard label="Hoje" value={num(hoje)} accent="brand" />
        <KpiCard label="Entidades" value={num(entities.length)} accent="violet" />
        <KpiCard label="Tipos de ação" value={num(actions.length)} accent="ink" />
      </div>

      <Card className="my-4">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <select name="entidade" defaultValue={sp.entidade ?? ''} className="input max-w-[220px]">
            <option value="">Todas as entidades</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <select name="acao" defaultValue={sp.acao ?? ''} className="input max-w-[220px]">
            <option value="">Todas as ações</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button className="btn-primary" type="submit">
            Filtrar
          </button>
        </form>
      </Card>

      <div className="table-wrap">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-surface-2/60">
            <tr>
              <th className="th">Quando</th>
              <th className="th">Quem</th>
              <th className="th">Ação</th>
              <th className="th">Entidade</th>
              <th className="th">Resumo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ log, user }) => (
              <tr key={log.id} className="row-hover">
                <td className="td text-ink-500">{formatDateTime(log.createdAt)}</td>
                <td className="td">
                  {user?.name ? (
                    <span className="flex items-center gap-2">
                      <Avatar name={user.name} color={user.avatarColor ?? '#8593ac'} size={22} />
                      {user.name}
                    </span>
                  ) : (
                    <span className="text-ink-400">sistema</span>
                  )}
                </td>
                <td className="td">
                  <Badge tone={ACTION_TONE[log.action] ?? 'ink'}>{log.action.toLowerCase()}</Badge>
                </td>
                <td className="td text-ink-600">{log.entity}</td>
                <td className="td max-w-[420px] truncate text-ink-700">{log.summary}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
