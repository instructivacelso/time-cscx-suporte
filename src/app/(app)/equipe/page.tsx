import { eq, sql } from 'drizzle-orm';
import { Avatar, Badge, Card, KpiCard, PageHeader, SectionTitle } from '@/components/ui';
import { db } from '@/db';
import { alerts, students, tasks, users } from '@/db/schema';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDateTime, num } from '@/lib/format';
import { createUserAction, toggleUserAction } from '@/app/actions';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const session = await getSession();
  const manage = can(session?.role, 'equipe.manage');

  const rows = await db
    .select({
      user: users,
      carteira: sql<number>`(select count(*)::int from students s where s.owner_id = ${users.id} and s.active)`,
      risco: sql<number>`(select count(*)::int from students s where s.owner_id = ${users.id} and s.active and s.health_band in ('RISCO','CRITICO'))`,
      healthMedio: sql<number>`(select coalesce(round(avg(s.health_score)),0)::int from students s where s.owner_id = ${users.id} and s.active)`,
      tarefasAbertas: sql<number>`(select count(*)::int from tasks t where t.owner_id = ${users.id} and t.status in ('ABERTA','EM_ANDAMENTO'))`,
      tarefasAtrasadas: sql<number>`(select count(*)::int from tasks t where t.owner_id = ${users.id} and t.status in ('ABERTA','EM_ANDAMENTO') and t.due_at < now())`,
    })
    .from(users)
    .orderBy(users.role, users.name);

  const ativos = rows.filter((r) => r.user.active).length;

  return (
    <>
      <PageHeader title="Equipe" subtitle="Perfis de acesso e desempenho de cada carteira." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Usuários" value={num(rows.length)} />
        <KpiCard label="Ativos" value={num(ativos)} accent="green" />
        <KpiCard
          label="Analistas"
          value={num(rows.filter((r) => r.user.role === 'ANALISTA').length)}
          accent="brand"
        />
        <KpiCard
          label="Alunos com responsável"
          value={num(rows.reduce((s, r) => s + Number(r.carteira), 0))}
          accent="violet"
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-4">
        {manage && (
          <Card>
            <SectionTitle title="Novo usuário" />
            <form action={createUserAction} className="space-y-2">
              <input name="name" className="input" placeholder="Nome completo" required />
              <input name="email" type="email" className="input" placeholder="E-mail" required />
              <input
                name="password"
                type="password"
                className="input"
                placeholder="Senha (mínimo 6 caracteres)"
                required
                minLength={6}
              />
              <select name="role" className="input">
                {(['ADMIN', 'COORDENADOR', 'ANALISTA', 'ALUNO'] as const).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <input name="avatarColor" type="color" defaultValue="#3366ff" className="input h-10" />
              <button className="btn-primary w-full" type="submit">
                Criar usuário
              </button>
            </form>
          </Card>
        )}

        <div className={manage ? 'xl:col-span-3' : 'xl:col-span-4'}>
          <div className="table-wrap">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-surface-2/60">
                <tr>
                  <th className="th">Usuário</th>
                  <th className="th">Perfil</th>
                  <th className="th">Carteira</th>
                  <th className="th">Em risco</th>
                  <th className="th">Health médio</th>
                  <th className="th">Tarefas</th>
                  <th className="th">Último acesso</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.user.id} className="row-hover">
                    <td className="td">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={r.user.name} color={r.user.avatarColor} size={30} />
                        <span>
                          <span className="block font-medium text-ink-900">{r.user.name}</span>
                          <span className="block text-xs text-ink-500">{r.user.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="td">
                      <Badge
                        tone={
                          r.user.role === 'ADMIN'
                            ? 'red'
                            : r.user.role === 'COORDENADOR'
                              ? 'violet'
                              : r.user.role === 'ANALISTA'
                                ? 'brand'
                                : 'ink'
                        }
                      >
                        {ROLE_LABELS[r.user.role]}
                      </Badge>
                    </td>
                    <td className="td">{r.carteira}</td>
                    <td className="td">
                      <span className={Number(r.risco) > 0 ? 'font-medium text-rose-600 dark:text-rose-400' : ''}>
                        {r.risco}
                      </span>
                    </td>
                    <td className="td">{r.healthMedio}</td>
                    <td className="td">
                      {r.tarefasAbertas}
                      {Number(r.tarefasAtrasadas) > 0 && (
                        <span className="ml-1 text-xs text-rose-600 dark:text-rose-400">({r.tarefasAtrasadas} atrasadas)</span>
                      )}
                    </td>
                    <td className="td text-ink-500">{formatDateTime(r.user.lastLoginAt)}</td>
                    <td className="td">
                      {manage ? (
                        <form action={toggleUserAction}>
                          <input type="hidden" name="userId" value={r.user.id} />
                          <input type="hidden" name="active" value={String(!r.user.active)} />
                          <button
                            className={`chip border ${
                              r.user.active
                                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : 'border-line bg-surface text-ink-500'
                            }`}
                          >
                            {r.user.active ? 'ativo' : 'inativo'}
                          </button>
                        </form>
                      ) : (
                        <Badge tone={r.user.active ? 'green' : 'ink'}>
                          {r.user.active ? 'ativo' : 'inativo'}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Card className="mt-4">
            <SectionTitle title="O que cada perfil pode fazer" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  role: 'Administrador',
                  items: ['Acesso total', 'Gerencia equipe', 'Configura integrações', 'Vê auditoria'],
                },
                {
                  role: 'Coordenador CSCX',
                  items: [
                    'Vê toda a carteira',
                    'Cria playbooks e automações',
                    'Dashboards gerencial e executivo',
                    'Acompanha a equipe',
                  ],
                },
                {
                  role: 'Analista CSCX',
                  items: [
                    'Acompanha sua carteira',
                    'Registra contatos e tarefas',
                    'Conduz o onboarding',
                    'Envia pesquisas e atualiza Health Score',
                  ],
                },
                {
                  role: 'Aluno',
                  items: [
                    'Progresso e trilha',
                    'Tarefas e metas',
                    'Certificado e histórico',
                    'Mensagens e pesquisas',
                  ],
                },
              ].map((p) => (
                <div key={p.role} className="rounded-lg border border-line p-3">
                  <p className="mb-1.5 text-sm font-semibold text-ink-900">{p.role}</p>
                  <ul className="space-y-1 text-xs text-ink-600">
                    {p.items.map((i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                        {i}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
