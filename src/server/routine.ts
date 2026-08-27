import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { alerts, enrollments, payments, students, surveyResponses } from '@/db/schema';
import { recalculateStudentHealth } from './health-service';
import { countOpenComplaints, daysBehindSchedule, evaluateAlertRules, syncStudentAlerts } from './alerts-service';
import { refreshStageFor } from './journey-service';
import { createRecoveryPlan } from './action-plan-service';
import { runAutomations } from './automation-service';
import { createSurvey, schedulePeriodicNps } from './survey-service';

const DAY = 86_400_000;

export interface RoutineReport {
  processed: number;
  alertsCreated: number;
  alertsResolved: number;
  plansCreated: number;
  automationsFired: number;
  surveysScheduled: number;
  paymentsUpdated: number;
  durationMs: number;
  startedAt: string;
}

/**
 * Rotina diária do CSCX.
 *
 * 1. Atualiza dias sem acesso e situação financeira.
 * 2. Recalcula o Health Score de todos os alunos ativos.
 * 3. Reavalia as regras de alertas inteligentes.
 * 4. Abre planos de recuperação para alunos em risco.
 * 5. Dispara as automações dos gatilhos correspondentes.
 * 6. Agenda as pesquisas de NPS em D+30/60/90.
 */
export async function runDailyRoutine(): Promise<RoutineReport> {
  const start = Date.now();
  const report: RoutineReport = {
    processed: 0,
    alertsCreated: 0,
    alertsResolved: 0,
    plansCreated: 0,
    automationsFired: 0,
    surveysScheduled: 0,
    paymentsUpdated: 0,
    durationMs: 0,
    startedAt: new Date().toISOString(),
  };

  // 1. Situação financeira derivada das parcelas.
  const overdue = await db
    .select({ studentId: payments.studentId, n: sql<number>`count(*)::int` })
    .from(payments)
    .where(and(isNull(payments.paidAt), lt(payments.dueAt, new Date())))
    .groupBy(payments.studentId);

  const overdueMap = new Map(overdue.map((o) => [o.studentId, Number(o.n)]));

  const allStudents = await db.select().from(students).where(eq(students.active, true));

  for (const s of allStudents) {
    const n = overdueMap.get(s.id) ?? 0;
    const status = n === 0 ? 'EM_DIA' : n >= 2 ? 'INADIMPLENTE' : 'ATRASADO';
    const days = s.lastAccessAt
      ? Math.min(365, Math.floor((Date.now() - s.lastAccessAt.getTime()) / DAY))
      : 999;
    if (s.paymentStatus !== status || s.daysWithoutAccess !== days) {
      await db
        .update(students)
        .set({
          paymentStatus: s.paymentStatus === 'ISENTO' ? 'ISENTO' : status,
          daysWithoutAccess: Math.min(days, 365),
          updatedAt: new Date(),
        })
        .where(eq(students.id, s.id));
      report.paymentsUpdated += 1;
    }
  }

  // 2-5. Loop principal por aluno.
  for (const s of allStudents) {
    const recalc = await recalculateStudentHealth(s.id);
    if (!recalc) continue;
    report.processed += 1;

    const [complaints, behind] = await Promise.all([
      countOpenComplaints(s.id),
      daysBehindSchedule(s.id),
    ]);

    const candidates = evaluateAlertRules({
      studentName: s.name,
      input: recalc.input,
      score: recalc.score,
      previousScore: recalc.previousScore,
      churnRisk: recalc.churnRisk,
      openComplaints: complaints,
      daysBehindSchedule: behind,
    });

    const sync = await syncStudentAlerts(s.id, candidates);
    report.alertsCreated += sync.created;
    report.alertsResolved += sync.resolved;

    await refreshStageFor(s.id);

    // Plano de recuperação automático.
    if (recalc.band === 'RISCO' || recalc.band === 'CRITICO' || recalc.churnRisk >= 70) {
      const plan = await createRecoveryPlan({ studentId: s.id, health: recalc });
      if (plan && Date.now() - plan.createdAt.getTime() < 60_000) report.plansCreated += 1;

      const fired = await runAutomations('ALUNO_EM_RISCO', {
        studentId: s.id,
        vars: { motivo: recalc.topRisks[0] ?? 'Indicadores em queda' },
      });
      report.automationsFired += fired.length;
    }

    // Aluno parado.
    if (recalc.input.daysWithoutAccess >= 7 && recalc.input.daysWithoutAccess < 8) {
      const fired = await runAutomations('ALUNO_PARADO', {
        studentId: s.id,
        vars: { curso: '' },
      });
      report.automationsFired += fired.length;
    }

    // Reta final.
    if (recalc.input.progressPercent >= 80 && recalc.input.progressPercent < 100) {
      const already = await db
        .select({ id: alerts.id })
        .from(alerts)
        .where(and(eq(alerts.studentId, s.id), eq(alerts.type, 'CRONOGRAMA_ATRASADO')))
        .limit(1);
      if (!already.length) {
        const fired = await runAutomations('ALUNO_CONCLUINDO', { studentId: s.id });
        report.automationsFired += fired.length;
      }
    }

    // Promotores.
    if (s.npsLast !== null && s.npsLast >= 9) {
      const fired = await runAutomations('ALUNO_PROMOTOR', { studentId: s.id });
      report.automationsFired += fired.length;
    }
  }

  // 6. Pesquisas periódicas.
  const scheduled = await schedulePeriodicNps();
  report.surveysScheduled = scheduled.length;

  // Pesquisa de conclusão para quem certificou e ainda não respondeu.
  const certified = await db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(eq(enrollments.status, 'CONCLUIDA'));

  for (const c of certified) {
    const existing = await db
      .select({ id: surveyResponses.id })
      .from(surveyResponses)
      .where(
        and(
          eq(surveyResponses.studentId, c.studentId),
          eq(surveyResponses.trigger, 'CONCLUSAO'),
          eq(surveyResponses.type, 'NPS'),
        ),
      )
      .limit(1);
    if (!existing.length) {
      await createSurvey({ studentId: c.studentId, type: 'NPS', trigger: 'CONCLUSAO' });
      report.surveysScheduled += 1;
    }
  }

  report.durationMs = Date.now() - start;
  return report;
}

/** Rotina rápida: só recalcula o Health Score e os alertas de um aluno. */
export async function refreshStudent(studentId: string) {
  const recalc = await recalculateStudentHealth(studentId);
  if (!recalc) return null;
  const [student] = await db.select().from(students).where(eq(students.id, studentId));
  const [complaints, behind] = await Promise.all([
    countOpenComplaints(studentId),
    daysBehindSchedule(studentId),
  ]);
  const candidates = evaluateAlertRules({
    studentName: student?.name ?? '',
    input: recalc.input,
    score: recalc.score,
    previousScore: recalc.previousScore,
    churnRisk: recalc.churnRisk,
    openComplaints: complaints,
    daysBehindSchedule: behind,
  });
  await syncStudentAlerts(studentId, candidates);
  await refreshStageFor(studentId);
  return recalc;
}

export async function openAlertCount() {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(alerts)
    .where(inArray(alerts.status, ['ABERTO', 'EM_TRATATIVA']));
  return Number(row?.n ?? 0);
}
