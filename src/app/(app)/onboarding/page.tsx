import Link from 'next/link';
import { CheckCircle2, Circle, Mail, MessageSquare, PlayCircle, Rocket } from 'lucide-react';
import { and, asc, eq, lt, sql } from 'drizzle-orm';
import { Card, KpiCard, PageHeader, Progress, SectionTitle } from '@/components/ui';
import { db } from '@/db';
import { onboardingItems, students } from '@/db/schema';
import { ONBOARDING_CHECKLIST } from '@/lib/constants';
import { formatDate, num, pct } from '@/lib/format';
import { toggleOnboardingAction } from '@/app/actions';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const session = await getSession();
  const editable = can(session?.role, 'onboarding.manage');

  const [emAndamento, itemStats, resumo] = await Promise.all([
    db
      .select()
      .from(students)
      .where(and(eq(students.active, true), lt(students.onboardingPercent, 100)))
      .orderBy(asc(students.onboardingPercent))
      .limit(40),
    db
      .select({
        key: onboardingItems.key,
        label: onboardingItems.label,
        done: sql<number>`count(*) filter (where ${onboardingItems.done})::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(onboardingItems)
      .groupBy(onboardingItems.key, onboardingItems.label),
    db
      .select({
        total: sql<number>`count(*)::int`,
        completos: sql<number>`count(*) filter (where ${students.onboardingPercent} >= 100)::int`,
        media: sql<number>`coalesce(avg(${students.onboardingPercent}), 0)`,
        travados: sql<number>`count(*) filter (where ${students.onboardingPercent} < 50 and ${students.enrolledAt} < now() - interval '7 days')::int`,
      })
      .from(students)
      .where(eq(students.active, true)),
  ]);

  const r = resumo[0];
  const ordered = ONBOARDING_CHECKLIST.map((c) => itemStats.find((i) => i.key === c.key)).filter(
    Boolean,
  ) as typeof itemStats;

  const detalhes = await Promise.all(
    emAndamento.slice(0, 20).map(async (s) => ({
      student: s,
      items: await db
        .select()
        .from(onboardingItems)
        .where(eq(onboardingItems.studentId, s.id))
        .orderBy(asc(onboardingItems.order)),
    })),
  );

  return (
    <>
      <PageHeader
        title="Onboarding"
        subtitle="Régua automática de entrada: boas-vindas, tutorial, comunidade e cronograma."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Alunos ativos" value={num(Number(r.total))} icon={<Rocket className="h-4 w-4" />} />
        <KpiCard label="Onboarding completo" value={num(Number(r.completos))} accent="green" />
        <KpiCard label="Média de conclusão" value={pct(Number(r.media))} accent="brand" />
        <KpiCard label="Travados há 7+ dias" value={num(Number(r.travados))} accent="red" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card>
          <SectionTitle title="Régua automática" description="O que o sistema dispara na entrada." />
          <ol className="space-y-2.5">
            {[
              { icon: MessageSquare, t: 'Mensagem de boas-vindas', d: 'WhatsApp, imediato' },
              { icon: Mail, t: 'E-mail de boas-vindas', d: 'Com tutorial e vídeo institucional' },
              { icon: PlayCircle, t: 'Vídeo institucional', d: 'Apresentação da escola e do método' },
              { icon: PlayCircle, t: 'Tutorial da plataforma', d: 'Como navegar, baixar material e tirar dúvidas' },
              { icon: MessageSquare, t: 'Apresentação do mentor', d: 'D+3, WhatsApp' },
              { icon: Mail, t: 'Pesquisa CSAT de onboarding', d: 'D+7' },
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <step.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink-900">{step.t}</p>
                  <p className="text-xs text-ink-500">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle
            title="Conclusão por item do checklist"
            description="Onde os alunos mais travam na entrada."
          />
          <ul className="space-y-3">
            {ordered.map((i) => {
              const percent = i.total ? (Number(i.done) / Number(i.total)) * 100 : 0;
              return (
                <li key={i.key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-ink-800">{i.label}</span>
                    <span className="text-xs text-ink-500">
                      {i.done}/{i.total} · {Math.round(percent)}%
                    </span>
                  </div>
                  <Progress value={percent} tone={percent >= 70 ? 'green' : percent >= 40 ? 'amber' : 'red'} />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle
          title="Alunos com onboarding em aberto"
          description="Marque os itens conforme a equipe conclui cada etapa."
        />
        <div className="space-y-3">
          {detalhes.map(({ student, items }) => (
            <div key={student.id} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/alunos/${student.id}?tab=jornada`}
                  className="text-sm font-medium text-ink-900 hover:text-brand-700"
                >
                  {student.name}
                </Link>
                <span className="text-xs text-ink-500">
                  matrícula {formatDate(student.enrolledAt)}
                </span>
                <span className="ml-auto w-32">
                  <Progress value={student.onboardingPercent} showLabel />
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <form key={item.id} action={toggleOnboardingAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="done" value={String(!item.done)} />
                    <button
                      type="submit"
                      disabled={!editable}
                      className={`chip border transition ${
                        item.done
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'border-line bg-surface text-ink-500 hover:bg-surface-2'
                      }`}
                    >
                      {item.done ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Circle className="h-3 w-3" />
                      )}
                      {item.label}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ))}
          {detalhes.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-500">
              Todo mundo com onboarding concluído. 🎉
            </p>
          )}
        </div>
      </Card>
    </>
  );
}
