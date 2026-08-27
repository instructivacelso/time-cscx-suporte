import Link from 'next/link';
import { Card, HealthBadge, KpiCard, PageHeader, SectionTitle, SeverityBadge, StatusBadge } from '@/components/ui';
import { listAlerts } from '@/server/alerts-service';
import { ALERT_TYPE_LABELS } from '@/lib/constants';
import { formatDateTime, num, relativeDays } from '@/lib/format';
import { updateAlertAction } from '@/app/actions';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

const SEVERITIES = ['CRITICA', 'ALTA', 'ATENCAO', 'INFO'];

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ severidade?: string; status?: string; tipo?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const seeAll = can(session?.role, 'carteira.viewAll');

  const rows = await listAlerts({
    status: sp.status ? [sp.status] : ['ABERTO', 'EM_TRATATIVA'],
    severity: sp.severidade ? [sp.severidade] : undefined,
    ownerId: seeAll ? undefined : session?.id,
    limit: 300,
  });

  const filtered = sp.tipo ? rows.filter((r) => r.alert.type === sp.tipo) : rows;

  const bySeverity = SEVERITIES.map((s) => ({
    severity: s,
    total: rows.filter((r) => r.alert.severity === s).length,
  }));

  const byType = Object.keys(ALERT_TYPE_LABELS)
    .map((t) => ({ type: t, total: rows.filter((r) => r.alert.type === t).length }))
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <PageHeader
        title="Alertas inteligentes"
        subtitle="Regras automáticas que apontam risco antes da evasão acontecer."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {bySeverity.map((s) => (
          <KpiCard
            key={s.severity}
            label={s.severity === 'ATENCAO' ? 'Atenção' : s.severity.toLowerCase()}
            value={num(s.total)}
            accent={s.severity === 'CRITICA' || s.severity === 'ALTA' ? 'red' : s.severity === 'ATENCAO' ? 'amber' : 'ink'}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-4">
        <Card>
          <SectionTitle title="Filtrar" />
          <form method="get" className="space-y-2">
            <select name="severidade" defaultValue={sp.severidade ?? ''} className="input">
              <option value="">Todas as severidades</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={sp.status ?? ''} className="input">
              <option value="">Abertos e em tratativa</option>
              <option value="ABERTO">Abertos</option>
              <option value="EM_TRATATIVA">Em tratativa</option>
              <option value="RESOLVIDO">Resolvidos</option>
              <option value="IGNORADO">Ignorados</option>
            </select>
            <select name="tipo" defaultValue={sp.tipo ?? ''} className="input">
              <option value="">Todos os tipos</option>
              {Object.entries(ALERT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button className="btn-primary w-full" type="submit">
              Aplicar
            </button>
          </form>

          <div className="mt-4 border-t border-line pt-3">
            <p className="label mb-2">Por tipo</p>
            <ul className="space-y-1">
              {byType.map((t) => (
                <li key={t.type}>
                  <Link
                    href={`/alertas?tipo=${t.type}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs text-ink-600 transition hover:bg-surface-2"
                  >
                    <span>{ALERT_TYPE_LABELS[t.type]}</span>
                    <span className="font-medium text-ink-900">{t.total}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <div className="space-y-3 xl:col-span-3">
          {filtered.map(({ alert, student }) => (
            <Card key={alert.id}>
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={alert.severity} />
                <StatusBadge status={alert.status} />
                <span className="text-xs text-ink-500">{ALERT_TYPE_LABELS[alert.type]}</span>
                <span className="ml-auto text-xs text-ink-400" title={formatDateTime(alert.createdAt)}>
                  {relativeDays(alert.createdAt)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link
                  href={`/alunos/${student.id}`}
                  className="text-sm font-semibold text-ink-900 hover:text-brand-700"
                >
                  {student.name}
                </Link>
                <HealthBadge band={student.healthBand} score={student.healthScore} size="sm" />
              </div>

              <p className="mt-1 text-sm font-medium text-ink-800">{alert.title}</p>
              <p className="text-sm text-ink-600">{alert.description}</p>

              {alert.status !== 'RESOLVIDO' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {alert.status === 'ABERTO' && (
                    <form action={updateAlertAction}>
                      <input type="hidden" name="alertId" value={alert.id} />
                      <input type="hidden" name="status" value="EM_TRATATIVA" />
                      <button className="btn-ghost px-2.5 py-1 text-xs">Assumir tratativa</button>
                    </form>
                  )}
                  <form action={updateAlertAction}>
                    <input type="hidden" name="alertId" value={alert.id} />
                    <input type="hidden" name="status" value="RESOLVIDO" />
                    <button className="btn-subtle px-2.5 py-1 text-xs">Resolver</button>
                  </form>
                  <form action={updateAlertAction}>
                    <input type="hidden" name="alertId" value={alert.id} />
                    <input type="hidden" name="status" value="IGNORADO" />
                    <button className="btn-ghost px-2.5 py-1 text-xs">Ignorar</button>
                  </form>
                  <Link href={`/alunos/${student.id}?tab=planos`} className="btn-ghost px-2.5 py-1 text-xs">
                    Abrir plano de ação
                  </Link>
                </div>
              )}
            </Card>
          ))}

          {filtered.length === 0 && (
            <Card>
              <p className="py-10 text-center text-sm text-ink-500">
                Nenhum alerta com esses filtros. 🎉
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
