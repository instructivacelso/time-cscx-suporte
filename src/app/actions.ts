'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  actionPlans,
  alerts,
  automations,
  healthScoreConfig,
  integrations,
  interactions,
  students,
  tasks,
  users,
} from '@/db/schema';
import { requireSession } from '@/lib/auth';
import { assertCan } from '@/lib/rbac';
import { recordAudit } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';
import { refreshStudent, runDailyRoutine } from '@/server/routine';
import { toggleOnboardingItem, setStage } from '@/server/journey-service';
import { answerSurvey, createSurvey } from '@/server/survey-service';
import { createRecoveryPlan, closePlan } from '@/server/action-plan-service';
import { runAutomations } from '@/server/automation-service';
import { saveHealthConfig } from '@/server/health-service';
import { getStudent360 } from '@/server/student-service';
import { draftMessage, suggestActionPlan, summarizeStudent } from '@/server/ai-service';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, type HealthIndicatorKey } from '@/lib/health-score';
import type { JourneyStage } from '@/db/schema';

/* ── Aluno ─────────────────────────────────────────────── */

export async function addInteractionAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'interacao.create');

  const studentId = String(formData.get('studentId'));
  await db.insert(interactions).values({
    studentId,
    userId: session.id,
    channel: String(formData.get('channel') ?? 'WHATSAPP') as never,
    direction: String(formData.get('direction') ?? 'SAIDA') as never,
    subject: String(formData.get('subject') ?? 'Contato'),
    content: String(formData.get('content') ?? ''),
    responseMinutes: formData.get('responseMinutes')
      ? Number(formData.get('responseMinutes'))
      : null,
  });

  await recordAudit({
    userId: session.id,
    action: 'CREATE',
    entity: 'interaction',
    entityId: studentId,
    summary: `Interação registrada para o aluno ${studentId}`,
  });

  revalidatePath(`/alunos/${studentId}`);
}

export async function updateStudentNotesAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'aluno.edit');
  const studentId = String(formData.get('studentId'));
  const notes = String(formData.get('notes') ?? '');
  await db.update(students).set({ notes, updatedAt: new Date() }).where(eq(students.id, studentId));
  await recordAudit({
    userId: session.id,
    action: 'UPDATE',
    entity: 'student',
    entityId: studentId,
    summary: 'Observações do aluno atualizadas',
  });
  revalidatePath(`/alunos/${studentId}`);
}

export async function setStudentOwnerAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'aluno.edit');
  const studentId = String(formData.get('studentId'));
  const ownerId = String(formData.get('ownerId') || '') || null;
  await db.update(students).set({ ownerId, updatedAt: new Date() }).where(eq(students.id, studentId));
  await recordAudit({
    userId: session.id,
    action: 'UPDATE',
    entity: 'student',
    entityId: studentId,
    summary: 'Responsável pela carteira alterado',
  });
  revalidatePath(`/alunos/${studentId}`);
}

export async function recalcStudentAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'aluno.healthScore.update');
  const studentId = String(formData.get('studentId'));
  const result = await refreshStudent(studentId);
  await recordAudit({
    userId: session.id,
    action: 'RECALC',
    entity: 'student',
    entityId: studentId,
    summary: `Health Score recalculado: ${result?.score ?? '—'}`,
  });
  revalidatePath(`/alunos/${studentId}`);
}

export async function setStageAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'aluno.edit');
  const studentId = String(formData.get('studentId'));
  const stage = String(formData.get('stage')) as JourneyStage;
  await setStage(studentId, stage, { automatic: false, note: `Alterado por ${session.name}` });
  await recordAudit({
    userId: session.id,
    action: 'UPDATE',
    entity: 'student',
    entityId: studentId,
    summary: `Etapa da jornada alterada para ${stage}`,
  });
  revalidatePath(`/alunos/${studentId}`);
  revalidatePath('/jornada');
}

export async function toggleOnboardingAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'onboarding.manage');
  const itemId = String(formData.get('itemId'));
  const done = String(formData.get('done')) === 'true';
  const item = await toggleOnboardingItem(itemId, done);
  if (item) {
    await refreshStudent(item.studentId);
    revalidatePath(`/alunos/${item.studentId}`);
  }
  revalidatePath('/onboarding');
}

/* ── Alertas ───────────────────────────────────────────── */

export async function updateAlertAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'carteira.view');
  const alertId = String(formData.get('alertId'));
  const status = String(formData.get('status'));
  await db
    .update(alerts)
    .set({
      status: status as never,
      resolvedAt: status === 'RESOLVIDO' || status === 'IGNORADO' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(alerts.id, alertId));
  await recordAudit({
    userId: session.id,
    action: 'UPDATE',
    entity: 'alert',
    entityId: alertId,
    summary: `Alerta marcado como ${status}`,
  });
  revalidatePath('/alertas');
}

/* ── Tarefas ───────────────────────────────────────────── */

export async function createTaskAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'tarefa.create');
  const studentId = String(formData.get('studentId') || '') || null;
  await db.insert(tasks).values({
    studentId,
    ownerId: String(formData.get('ownerId') || '') || session.id,
    createdById: session.id,
    title: String(formData.get('title') ?? 'Nova tarefa'),
    description: String(formData.get('description') ?? '') || null,
    priority: (String(formData.get('priority') || 'MEDIA') as never) ?? 'MEDIA',
    dueAt: formData.get('dueAt') ? new Date(String(formData.get('dueAt'))) : null,
  });
  await recordAudit({
    userId: session.id,
    action: 'CREATE',
    entity: 'task',
    summary: `Tarefa criada: ${formData.get('title')}`,
  });
  revalidatePath('/tarefas');
  if (studentId) revalidatePath(`/alunos/${studentId}`);
}

export async function updateTaskStatusAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'tarefa.create');
  const taskId = String(formData.get('taskId'));
  const status = String(formData.get('status'));
  await db
    .update(tasks)
    .set({
      status: status as never,
      completedAt: status === 'CONCLUIDA' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));
  await recordAudit({
    userId: session.id,
    action: 'UPDATE',
    entity: 'task',
    entityId: taskId,
    summary: `Tarefa ${status}`,
  });
  revalidatePath('/tarefas');
  revalidatePath('/planos-acao');
}

/* ── Planos de ação ────────────────────────────────────── */

export async function createPlanAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'planoAcao.manage');
  const studentId = String(formData.get('studentId'));
  const s = await getStudent360(studentId);
  if (!s?.healthResult) return;
  await createRecoveryPlan({
    studentId,
    health: s.healthResult,
    ownerId: session.id,
    titleOverride: String(formData.get('title') || '') || undefined,
    strategyOverride: String(formData.get('strategy') || '') || undefined,
    generatedByAI: formData.get('ai') === '1',
  });
  await recordAudit({
    userId: session.id,
    action: 'CREATE',
    entity: 'action_plan',
    entityId: studentId,
    summary: 'Plano de recuperação criado',
  });
  revalidatePath('/planos-acao');
  revalidatePath(`/alunos/${studentId}`);
}

export async function closePlanAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'planoAcao.manage');
  const planId = String(formData.get('planId'));
  const success = String(formData.get('success')) === 'true';
  await closePlan(planId, String(formData.get('outcome') ?? ''), success);
  await recordAudit({
    userId: session.id,
    action: 'UPDATE',
    entity: 'action_plan',
    entityId: planId,
    summary: success ? 'Plano concluído com sucesso' : 'Plano encerrado sem sucesso',
  });
  revalidatePath('/planos-acao');
}

/* ── Pesquisas ─────────────────────────────────────────── */

export async function sendSurveyAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'pesquisa.send');
  const studentId = String(formData.get('studentId'));
  const type = String(formData.get('type') ?? 'NPS') as 'NPS' | 'CSAT';
  const survey = await createSurvey({
    studentId,
    type,
    trigger: String(formData.get('trigger') ?? 'MANUAL') as never,
  });
  await runAutomations(type === 'NPS' ? 'PESQUISA_NPS' : 'PESQUISA_CSAT', {
    studentId,
    vars: { linkPesquisa: `${process.env.APP_URL ?? ''}/pesquisa/${survey.id}` },
  });
  await recordAudit({
    userId: session.id,
    action: 'CREATE',
    entity: 'survey',
    entityId: survey.id,
    summary: `Pesquisa ${type} enviada`,
  });
  revalidatePath('/pesquisas');
  revalidatePath(`/alunos/${studentId}`);
}

export async function answerSurveyAction(formData: FormData) {
  const id = String(formData.get('surveyId'));
  const score = Number(formData.get('score'));
  const comment = String(formData.get('comment') ?? '') || null;
  const row = await answerSurvey(id, score, comment);
  if (row) await refreshStudent(row.studentId);
  revalidatePath('/pesquisas');
  return { ok: Boolean(row) };
}

/* ── Automações ────────────────────────────────────────── */

export async function toggleAutomationAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'automacao.manage');
  const id = String(formData.get('automationId'));
  const active = String(formData.get('active')) === 'true';
  await db.update(automations).set({ active, updatedAt: new Date() }).where(eq(automations.id, id));
  await recordAudit({
    userId: session.id,
    action: 'UPDATE',
    entity: 'automation',
    entityId: id,
    summary: active ? 'Automação ativada' : 'Automação desativada',
  });
  revalidatePath('/automacoes');
}

export async function updateAutomationAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'automacao.manage');
  const id = String(formData.get('automationId'));
  await db
    .update(automations)
    .set({
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      template: String(formData.get('template') ?? ''),
      channel: String(formData.get('channel') ?? 'WHATSAPP') as never,
      delayHours: Number(formData.get('delayHours') ?? 0),
      updatedAt: new Date(),
    })
    .where(eq(automations.id, id));
  await recordAudit({
    userId: session.id,
    action: 'UPDATE',
    entity: 'automation',
    entityId: id,
    summary: 'Automação editada',
  });
  revalidatePath('/automacoes');
}

export async function runAutomationTestAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'automacao.manage');
  const studentId = String(formData.get('studentId'));
  const trigger = String(formData.get('trigger'));
  const result = await runAutomations(trigger as never, { studentId, dryRun: true });
  return { preview: result };
}

/* ── Configurações ─────────────────────────────────────── */

export async function saveHealthConfigAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'config.healthScore');

  const weights = { ...DEFAULT_WEIGHTS };
  (Object.keys(weights) as HealthIndicatorKey[]).forEach((k) => {
    const v = formData.get(`w_${k}`);
    if (v !== null) weights[k] = Number(v);
  });

  const thresholds = { ...DEFAULT_THRESHOLDS };
  (Object.keys(thresholds) as (keyof typeof thresholds)[]).forEach((k) => {
    const v = formData.get(`t_${k}`);
    if (v !== null) thresholds[k] = Number(v);
  });

  await saveHealthConfig(weights, thresholds);
  await recordAudit({
    userId: session.id,
    action: 'UPDATE',
    entity: 'health_config',
    summary: 'Pesos e faixas do Health Score atualizados',
  });
  revalidatePath('/configuracoes');
}

export async function resetHealthConfigAction() {
  const session = await requireSession();
  assertCan(session.role, 'config.healthScore');
  await db
    .insert(healthScoreConfig)
    .values({ id: 'default', weights: DEFAULT_WEIGHTS, thresholds: DEFAULT_THRESHOLDS })
    .onConflictDoUpdate({
      target: healthScoreConfig.id,
      set: { weights: DEFAULT_WEIGHTS, thresholds: DEFAULT_THRESHOLDS, updatedAt: new Date() },
    });
  revalidatePath('/configuracoes');
}

export async function runRoutineAction() {
  const session = await requireSession();
  assertCan(session.role, 'config.healthScore');
  const report = await runDailyRoutine();
  await recordAudit({
    userId: session.id,
    action: 'RUN',
    entity: 'routine',
    summary: `Rotina executada: ${report.processed} alunos, ${report.alertsCreated} alertas`,
    metadata: report,
  });
  revalidatePath('/dashboard');
  revalidatePath('/alertas');
  return report;
}

/* ── Equipe ────────────────────────────────────────────── */

export async function createUserAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'equipe.manage');
  const email = String(formData.get('email') ?? '').toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || password.length < 6) return;

  await db.insert(users).values({
    name: String(formData.get('name') ?? ''),
    email,
    passwordHash: await hashPassword(password),
    role: String(formData.get('role') ?? 'ANALISTA') as never,
    avatarColor: String(formData.get('avatarColor') ?? '#3366ff'),
  });
  await recordAudit({
    userId: session.id,
    action: 'CREATE',
    entity: 'user',
    summary: `Usuário criado: ${email}`,
  });
  revalidatePath('/equipe');
}

export async function toggleUserAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'equipe.manage');
  const id = String(formData.get('userId'));
  const active = String(formData.get('active')) === 'true';
  await db.update(users).set({ active, updatedAt: new Date() }).where(eq(users.id, id));
  await recordAudit({
    userId: session.id,
    action: 'UPDATE',
    entity: 'user',
    entityId: id,
    summary: active ? 'Usuário reativado' : 'Usuário desativado',
  });
  revalidatePath('/equipe');
}

/* ── Integrações ───────────────────────────────────────── */

export async function updateIntegrationAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'integracao.manage');
  const id = String(formData.get('integrationId'));
  await db
    .update(integrations)
    .set({
      status: String(formData.get('status') ?? 'NAO_CONFIGURADA') as never,
      notes: String(formData.get('notes') ?? '') || null,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, id));
  await recordAudit({
    userId: session.id,
    action: 'UPDATE',
    entity: 'integration',
    entityId: id,
    summary: 'Integração atualizada',
  });
  revalidatePath('/integracoes');
}

/* ── Assistente CSCX ───────────────────────────────────── */

export async function aiSummaryAction(studentId: string) {
  const session = await requireSession();
  assertCan(session.role, 'assistente.use');
  return (await summarizeStudent(studentId)) ?? '';
}

export async function aiPlanAction(studentId: string) {
  const session = await requireSession();
  assertCan(session.role, 'assistente.use');
  return (await suggestActionPlan(studentId)) ?? '';
}

export async function aiMessageAction(
  studentId: string,
  channel: 'WHATSAPP' | 'EMAIL' | 'FEEDBACK',
  intent: string,
) {
  const session = await requireSession();
  assertCan(session.role, 'assistente.use');
  return (await draftMessage(studentId, channel, intent)) ?? '';
}

export async function bulkResolveAlertsAction(formData: FormData) {
  const session = await requireSession();
  assertCan(session.role, 'carteira.viewAll');
  const type = String(formData.get('type'));
  await db
    .update(alerts)
    .set({ status: 'RESOLVIDO', resolvedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(alerts.type, type as never), inArray(alerts.status, ['ABERTO', 'EM_TRATATIVA'])));
  await recordAudit({
    userId: session.id,
    action: 'UPDATE',
    entity: 'alert',
    summary: `Alertas do tipo ${type} resolvidos em massa`,
  });
  revalidatePath('/alertas');
}

export async function assistantChatAction(input: {
  threadId?: string | null;
  studentId?: string | null;
  message: string;
}) {
  const session = await requireSession();
  assertCan(session.role, 'assistente.use');
  const { chat, ensureThread } = await import('@/server/ai-service');
  const thread = input.threadId
    ? { id: input.threadId }
    : await ensureThread(session.id, input.studentId ?? null, input.message.slice(0, 60));
  const answer = await chat(thread.id, input.message, input.studentId ?? null);
  return { threadId: thread.id, answer };
}

export async function assistantAnalyzeAction(scope: 'NPS' | 'CSAT' | 'HEALTH' | 'GERAL') {
  const session = await requireSession();
  assertCan(session.role, 'assistente.use');
  const { analyzeIndicators } = await import('@/server/ai-service');
  const { getDashboardBundle } = await import('@/server/metrics-service');
  const bundle = await getDashboardBundle();
  const data =
    scope === 'NPS'
      ? { npsTrend: bundle.npsTrend, metrics: { nps: bundle.metrics.nps, respostas: bundle.metrics.npsTotal } }
      : scope === 'CSAT'
        ? bundle.csat
        : scope === 'HEALTH'
          ? { healthTrend: bundle.healthTrend, metrics: bundle.metrics }
          : bundle.metrics;
  return analyzeIndicators({ scope, data });
}

/* ── Base de demonstração ──────────────────────────────── */

export async function seedDemoAction() {
  const session = await requireSession();
  if (session.role !== 'ADMIN') throw new Error('FORBIDDEN');

  const { seedDemoData } = await import('@/server/demo-seed');
  try {
    // keepUsers preserva a conta de quem está executando — a sessão continua válida.
    const r = await seedDemoData({ reset: true, keepUsers: true });
    await recordAudit({
      action: 'SEED',
      entity: 'database',
      summary: `Base de demonstração populada: ${r.alunos} alunos, ${r.cursos} cursos`,
    });
    // A carga de demonstração recria a equipe, então a sessão atual aponta para
    // um usuário que não existe mais — encerrar evita erros de chave estrangeira.
    revalidatePath('/dashboard');
    revalidatePath('/alunos');
    return { ok: true as const, ...r };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}
