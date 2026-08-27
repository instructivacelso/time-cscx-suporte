import Link from 'next/link';
import { AlertTriangle, Search } from 'lucide-react';
import { Avatar, Badge, Card, HealthBadge, PageHeader, Progress } from '@/components/ui';
import { listStudents } from '@/server/student-service';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { STAGE_LABELS } from '@/lib/constants';
import { formatDate, num, relativeDays } from '@/lib/format';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const BANDS = [
  { value: 'EXCELENTE', label: 'Excelente' },
  { value: 'SAUDAVEL', label: 'Saudável' },
  { value: 'ATENCAO', label: 'Atenção' },
  { value: 'RISCO', label: 'Risco' },
  { value: 'CRITICO', label: 'Crítico' },
];

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const seeAll = can(session?.role, 'carteira.viewAll');

  const analysts = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.active, true));

  const ownerId = seeAll ? sp.responsavel || undefined : session?.id;

  const { rows, total } = await listStudents({
    search: sp.q,
    band: sp.faixa ? [sp.faixa] : undefined,
    stage: sp.etapa ? [sp.etapa] : undefined,
    ownerId,
    onlyAtRisk: sp.risco === '1',
    orderBy: (sp.ordem as 'health' | 'name' | 'risk' | 'recent') ?? 'health',
    limit: 200,
  });

  return (
    <>
      <PageHeader
        title="Carteira de alunos"
        subtitle={`${num(total)} aluno(s) ${seeAll ? 'na base' : 'na sua carteira'}. Ordenados do menor para o maior Health Score.`}
      />

      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
            <input
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="Buscar por nome, e-mail ou código"
              className="input pl-9"
            />
          </div>

          <select name="faixa" defaultValue={sp.faixa ?? ''} className="input">
            <option value="">Todas as faixas</option>
            {BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>

          <select name="etapa" defaultValue={sp.etapa ?? ''} className="input">
            <option value="">Todas as etapas</option>
            {Object.entries(STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {seeAll && (
            <select name="responsavel" defaultValue={sp.responsavel ?? ''} className="input">
              <option value="">Todos os responsáveis</option>
              {analysts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          <select name="ordem" defaultValue={sp.ordem ?? 'health'} className="input">
            <option value="health">Menor Health Score</option>
            <option value="risk">Maior risco de evasão</option>
            <option value="recent">Matrícula mais recente</option>
            <option value="name">Nome (A–Z)</option>
          </select>

          <div className="flex items-center gap-2">
            <button className="btn-primary" type="submit">
              Filtrar
            </button>
            <Link href="/alunos" className="btn-ghost">
              Limpar
            </Link>
          </div>
        </form>
      </Card>

      <div className="table-wrap">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-surface-2/60">
            <tr>
              <th className="th">Aluno</th>
              <th className="th">Curso</th>
              <th className="th">Etapa</th>
              <th className="th">Health Score</th>
              <th className="th">Progresso</th>
              <th className="th">Último acesso</th>
              <th className="th">Risco</th>
              <th className="th">Responsável</th>
              <th className="th">Alertas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ student, owner, openAlerts, course }) => (
              <tr key={student.id} className="row-hover">
                <td className="td">
                  <Link href={`/alunos/${student.id}`} className="flex items-center gap-2.5">
                    <Avatar name={student.name} color="#8593ac" size={30} />
                    <span>
                      <span className="block font-medium text-ink-900">{student.name}</span>
                      <span className="block text-xs text-ink-500">
                        {student.code} · matrícula {formatDate(student.enrolledAt)}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="td max-w-[220px] truncate text-ink-600">{course ?? '—'}</td>
                <td className="td">
                  <Badge tone="brand">{STAGE_LABELS[student.stage]}</Badge>
                </td>
                <td className="td">
                  <HealthBadge band={student.healthBand} score={student.healthScore} size="sm" />
                </td>
                <td className="td w-40">
                  <Progress value={student.progressPercent} showLabel />
                </td>
                <td className="td text-ink-600">
                  {student.lastAccessAt ? (
                    <span className={student.daysWithoutAccess >= 7 ? 'text-rose-600 dark:text-rose-400' : ''}>
                      {relativeDays(student.lastAccessAt)}
                    </span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400">nunca acessou</span>
                  )}
                </td>
                <td className="td">
                  <span
                    className={
                      student.churnRisk >= 70
                        ? 'font-semibold text-rose-600 dark:text-rose-400'
                        : student.churnRisk >= 45
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-ink-600'
                    }
                  >
                    {student.churnRisk}%
                  </span>
                </td>
                <td className="td">
                  {owner ? (
                    <span className="flex items-center gap-2">
                      <Avatar name={owner.name} color={owner.avatarColor} size={22} />
                      <span className="text-ink-600">{owner.name.split(' ')[0]}</span>
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="td">
                  {openAlerts > 0 ? (
                    <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="h-3.5 w-3.5" /> {openAlerts}
                    </span>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-ink-500">
                  Nenhum aluno encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
