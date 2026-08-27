import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  enrollments,
  healthScoreConfig,
  healthSnapshots,
  interactions,
  mentorshipAttendances,
  onboardingItems,
  payments,
  students,
  studyActivities,
  surveyResponses,
  tickets,
} from '@/db/schema';
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  computeHealthScore,
  type HealthInput,
  type HealthResult,
  type HealthThresholds,
  type HealthWeights,
} from '@/lib/health-score';

const DAY = 86_400_000;

export async function getHealthConfig(): Promise<{
  weights: HealthWeights;
  thresholds: HealthThresholds;
}> {
  const [row] = await db.select().from(healthScoreConfig).where(eq(healthScoreConfig.id, 'default'));
  if (!row) {
    await db
      .insert(healthScoreConfig)
      .values({ id: 'default', weights: DEFAULT_WEIGHTS, thresholds: DEFAULT_THRESHOLDS })
      .onConflictDoNothing();
    return { weights: DEFAULT_WEIGHTS, thresholds: DEFAULT_THRESHOLDS };
  }
  return {
    weights: { ...DEFAULT_WEIGHTS, ...(row.weights as HealthWeights) },
    thresholds: { ...DEFAULT_THRESHOLDS, ...(row.thresholds as HealthThresholds) },
  };
}

export async function saveHealthConfig(weights: HealthWeights, thresholds: HealthThresholds) {
  await db
    .insert(healthScoreConfig)
    .values({ id: 'default', weights, thresholds })
    .onConflictDoUpdate({
      target: healthScoreConfig.id,
      set: { weights, thresholds, updatedAt: new Date() },
    });
}

/** Monta o pacote de sinais de um aluno para alimentar o motor de Health Score. */
export async function buildHealthInput(studentId: string): Promise<HealthInput | null> {
  const [student] = await db.select().from(students).where(eq(students.id, studentId));
  if (!student) return null;

  const now = Date.now();
  const since30 = new Date(now - 30 * DAY);
  const since60 = new Date(now - 60 * DAY);

  const [
    onboardingRows,
    activityRows,
    enrollmentRows,
    interactionRows,
    mentorshipRows,
    paymentRows,
    ticketRows,
    npsRow,
    csatRow,
  ] = await Promise.all([
    db.select().from(onboardingItems).where(eq(onboardingItems.studentId, studentId)),
    db
      .select()
      .from(studyActivities)
      .where(and(eq(studyActivities.studentId, studentId), gte(studyActivities.date, since30))),
    db.select().from(enrollments).where(eq(enrollments.studentId, studentId)),
    db
      .select()
      .from(interactions)
      .where(and(eq(interactions.studentId, studentId), gte(interactions.createdAt, since60))),
    db
      .select()
      .from(mentorshipAttendances)
      .where(and(eq(mentorshipAttendances.studentId, studentId), gte(mentorshipAttendances.date, since60))),
    db.select().from(payments).where(eq(payments.studentId, studentId)),
    db
      .select()
      .from(tickets)
      .where(and(eq(tickets.studentId, studentId), inArray(tickets.status, ['ABERTO', 'EM_ANDAMENTO']))),
    db
      .select()
      .from(surveyResponses)
      .where(and(eq(surveyResponses.studentId, studentId), eq(surveyResponses.type, 'NPS'), eq(surveyResponses.status, 'RESPONDIDA')))
      .orderBy(desc(surveyResponses.answeredAt))
      .limit(1),
    db
      .select()
      .from(surveyResponses)
      .where(and(eq(surveyResponses.studentId, studentId), eq(surveyResponses.type, 'CSAT'), eq(surveyResponses.status, 'RESPONDIDA')))
      .orderBy(desc(surveyResponses.answeredAt))
      .limit(1),
  ]);

  const onboardingPercent = onboardingRows.length
    ? (onboardingRows.filter((o) => o.done).length / onboardingRows.length) * 100
    : 0;

  const activeDays = new Set(activityRows.map((a) => a.date.toISOString().slice(0, 10))).size;
  const lessonsLast30 = activityRows.reduce((s, a) => s + a.lessonsDone, 0);
  const communityPosts = activityRows.reduce((s, a) => s + a.communityPosts, 0);

  const active = enrollmentRows.filter((e) => e.status !== 'CANCELADA');
  const progressPercent = active.length
    ? active.reduce((s, e) => s + e.progressPercent, 0) / active.length
    : 0;

  // Ritmo esperado: proporção do tempo decorrido entre início e previsão de término.
  const expectedProgressPercent = (() => {
    const vals = active
      .map((e) => {
        if (!e.expectedFinishAt) return null;
        const total = e.expectedFinishAt.getTime() - e.startedAt.getTime();
        if (total <= 0) return 100;
        const elapsed = now - e.startedAt.getTime();
        return Math.max(0, Math.min(100, (elapsed / total) * 100));
      })
      .filter((v): v is number => v !== null);
    if (!vals.length) return Math.max(10, progressPercent);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  })();

  const activitiesDone = active.reduce((s, e) => s + e.activitiesDone, 0);
  const activitiesTotal = active.reduce((s, e) => s + e.activitiesTotal, 0);
  const grades = active.map((e) => e.gradeAverage).filter((g): g is number => g !== null);
  const gradeAverage = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null;

  const answered = interactionRows.filter((i) => i.direction === 'ENTRADA').length;

  const overduePayments = paymentRows.filter(
    (p) => !p.paidAt && p.dueAt.getTime() < now,
  ).length;

  const diasDesdeMatricula = Math.max(0, Math.floor((now - student.enrolledAt.getTime()) / DAY));

  // Quem nunca acessou não está "999 dias sem acessar": está sem acessar desde
  // que se matriculou. Sem isso, todo aluno novo nascia com alerta crítico.
  const daysWithoutAccess = student.lastAccessAt
    ? Math.max(0, Math.floor((now - student.lastAccessAt.getTime()) / DAY))
    : diasDesdeMatricula;

  return {
    onboardingPercent,
    firstLessonDone: onboardingRows.find((o) => o.key === 'primeira_aula')?.done ?? false,
    daysWithoutAccess: Math.min(daysWithoutAccess, 365),
    activeDaysLast30: activeDays,
    expectedActiveDays: 12,
    progressPercent,
    expectedProgressPercent,
    lessonsLast30,
    activitiesDone,
    activitiesTotal,
    communityPostsLast30: communityPosts,
    gradeAverage,
    interactionsLast60: interactionRows.length,
    answeredInteractionsLast60: answered,
    npsLast: npsRow[0]?.score ?? null,
    csatLast: csatRow[0]?.score ?? null,
    paymentStatus: student.paymentStatus,
    overduePayments,
    mentorshipsOffered: mentorshipRows.length,
    mentorshipsAttended: mentorshipRows.filter((m) => m.attended).length,
    openComplaints: ticketRows.filter((t) => t.category.toLowerCase().includes('reclama')).length,
    daysSinceEnrollment: diasDesdeMatricula,
  };
}

export interface RecalcResult extends HealthResult {
  studentId: string;
  previousScore: number | null;
  input: HealthInput;
}

/** Recalcula o Health Score de um aluno, grava snapshot e atualiza o registro. */
export async function recalculateStudentHealth(
  studentId: string,
  opts: { persist?: boolean; snapshot?: boolean } = {},
): Promise<RecalcResult | null> {
  const { persist = true, snapshot = true } = opts;
  const input = await buildHealthInput(studentId);
  if (!input) return null;

  const { weights, thresholds } = await getHealthConfig();
  const result = computeHealthScore(input, weights, thresholds);

  const [current] = await db.select().from(students).where(eq(students.id, studentId));
  const previousScore = current?.healthScore ?? null;

  if (persist) {
    await db
      .update(students)
      .set({
        healthScore: result.score,
        healthBand: result.band,
        healthUpdatedAt: new Date(),
        previousHealth: previousScore,
        churnRisk: result.churnRisk,
        progressPercent: input.progressPercent,
        onboardingPercent: input.onboardingPercent,
        daysWithoutAccess: input.daysWithoutAccess,
        npsLast: input.npsLast,
        csatLast: input.csatLast,
        updatedAt: new Date(),
      })
      .where(eq(students.id, studentId));
  }

  if (snapshot) {
    await db.insert(healthSnapshots).values({
      studentId,
      score: result.score,
      band: result.band,
      breakdown: result.breakdown as never,
      churnRisk: result.churnRisk,
    });
  }

  return { ...result, studentId, previousScore, input };
}

export async function recalculateAll(limit = 5000) {
  const rows = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.active, true))
    .limit(limit);
  const results: RecalcResult[] = [];
  for (const row of rows) {
    const r = await recalculateStudentHealth(row.id);
    if (r) results.push(r);
  }
  return results;
}

export async function getHealthHistory(studentId: string, take = 30) {
  return db
    .select()
    .from(healthSnapshots)
    .where(eq(healthSnapshots.studentId, studentId))
    .orderBy(desc(healthSnapshots.createdAt))
    .limit(take);
}

export async function getHealthDistribution() {
  const rows = await db
    .select({ band: students.healthBand, total: sql<number>`count(*)::int` })
    .from(students)
    .where(eq(students.active, true))
    .groupBy(students.healthBand);
  return rows;
}
