import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { actionPlans, alerts, students, tasks, users } from '@/db/schema';
import type { HealthResult } from '@/lib/health-score';

const DAY = 86_400_000;

/** Passos padrão do plano de recuperação, de acordo com o motivo principal. */
function playbookSteps(topRisk: string | undefined, studentName: string) {
  const first = studentName.split(' ')[0];
  if (topRisk?.startsWith('Frequência')) {
    return [
      { title: `Contato ativo por WhatsApp com ${first}`, offsetDays: 1, priority: 'URGENTE' },
      { title: 'Diagnosticar o motivo da pausa e registrar no CRM', offsetDays: 2, priority: 'ALTA' },
      { title: 'Reprogramar cronograma com meta reduzida', offsetDays: 3, priority: 'ALTA' },
      { title: 'Convidar para a próxima mentoria ao vivo', offsetDays: 5, priority: 'MEDIA' },
      { title: 'Revisar Health Score e fechar o plano', offsetDays: 10, priority: 'MEDIA' },
    ];
  }
  if (topRisk?.startsWith('Financeiro')) {
    return [
      { title: 'Alinhar situação financeira com o time de cobrança', offsetDays: 1, priority: 'URGENTE' },
      { title: `Oferecer renegociação ou segunda via a ${first}`, offsetDays: 2, priority: 'ALTA' },
      { title: 'Confirmar regularização e liberar acesso', offsetDays: 7, priority: 'MEDIA' },
    ];
  }
  if (topRisk?.startsWith('Satisfação')) {
    return [
      { title: `Ligar para ${first} e ouvir a insatisfação`, offsetDays: 1, priority: 'URGENTE' },
      { title: 'Registrar o problema e acionar a área responsável', offsetDays: 2, priority: 'ALTA' },
      { title: 'Retornar ao aluno com a solução adotada', offsetDays: 5, priority: 'ALTA' },
      { title: 'Reenviar pesquisa de CSAT após a tratativa', offsetDays: 8, priority: 'MEDIA' },
    ];
  }
  if (topRisk?.startsWith('Progresso')) {
    return [
      { title: `Revisar cronograma de ${first} junto com o mentor`, offsetDays: 2, priority: 'ALTA' },
      { title: 'Definir meta semanal realista e registrar', offsetDays: 3, priority: 'ALTA' },
      { title: 'Enviar trilha de recuperação dos módulos pendentes', offsetDays: 4, priority: 'MEDIA' },
      { title: 'Checkpoint de progresso', offsetDays: 12, priority: 'MEDIA' },
    ];
  }
  return [
    { title: `Contato de diagnóstico com ${first}`, offsetDays: 1, priority: 'ALTA' },
    { title: 'Registrar causa raiz e combinar próximo passo', offsetDays: 3, priority: 'ALTA' },
    { title: 'Acompanhar evolução e revisar Health Score', offsetDays: 10, priority: 'MEDIA' },
  ];
}

export async function createRecoveryPlan(input: {
  studentId: string;
  health: HealthResult;
  ownerId?: string | null;
  generatedByAI?: boolean;
  titleOverride?: string;
  strategyOverride?: string;
}) {
  const [student] = await db.select().from(students).where(eq(students.id, input.studentId));
  if (!student) return null;

  const existing = await db
    .select()
    .from(actionPlans)
    .where(
      and(
        eq(actionPlans.studentId, input.studentId),
        inArray(actionPlans.status, ['ABERTO', 'EM_EXECUCAO']),
      ),
    );
  if (existing.length) return existing[0];

  const topRisk = input.health.topRisks[0];
  const steps = playbookSteps(topRisk, student.name);
  const ownerId = input.ownerId ?? student.ownerId;

  const [plan] = await db
    .insert(actionPlans)
    .values({
      studentId: input.studentId,
      ownerId: ownerId ?? null,
      title: input.titleOverride ?? `Plano de recuperação — ${student.name}`,
      reason:
        topRisk ??
        `Health Score ${input.health.score}/100 (${input.health.band}) com risco de evasão de ${input.health.churnRisk}%.`,
      strategy:
        input.strategyOverride ??
        steps.map((s, i) => `${i + 1}. ${s.title} (D+${s.offsetDays})`).join('\n'),
      status: 'ABERTO',
      dueAt: new Date(Date.now() + 14 * DAY),
      generatedByAi: input.generatedByAI ?? false,
    })
    .returning();

  await db.insert(tasks).values(
    steps.map((s) => ({
      studentId: input.studentId,
      ownerId: ownerId ?? null,
      actionPlanId: plan.id,
      title: s.title,
      priority: s.priority as 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE',
      dueAt: new Date(Date.now() + s.offsetDays * DAY),
    })),
  );

  return plan;
}

export async function listActionPlans(filter: { status?: string[]; ownerId?: string } = {}) {
  const conditions = [];
  if (filter.status?.length) conditions.push(inArray(actionPlans.status, filter.status as never));
  if (filter.ownerId) conditions.push(eq(actionPlans.ownerId, filter.ownerId));

  return db
    .select({
      plan: actionPlans,
      student: {
        id: students.id,
        name: students.name,
        code: students.code,
        healthScore: students.healthScore,
        healthBand: students.healthBand,
        churnRisk: students.churnRisk,
      },
      owner: { id: users.id, name: users.name, avatarColor: users.avatarColor },
    })
    .from(actionPlans)
    .innerJoin(students, eq(actionPlans.studentId, students.id))
    .leftJoin(users, eq(actionPlans.ownerId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(actionPlans.createdAt))
    .limit(200);
}

export async function planTasks(planId: string) {
  return db.select().from(tasks).where(eq(tasks.actionPlanId, planId)).orderBy(tasks.dueAt);
}

export async function closePlan(planId: string, outcome: string, success: boolean) {
  const [row] = await db
    .update(actionPlans)
    .set({
      status: success ? 'CONCLUIDO' : 'SEM_SUCESSO',
      outcome,
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(actionPlans.id, planId))
    .returning();
  return row;
}

export async function resolveAlertsForStudent(studentId: string, types?: string[]) {
  const conditions = [
    eq(alerts.studentId, studentId),
    inArray(alerts.status, ['ABERTO', 'EM_TRATATIVA']),
  ];
  if (types?.length) conditions.push(inArray(alerts.type, types as never));
  await db
    .update(alerts)
    .set({ status: 'RESOLVIDO', resolvedAt: new Date(), updatedAt: new Date() })
    .where(and(...conditions));
}
