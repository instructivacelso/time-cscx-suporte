import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { enrollments, journeyEvents, onboardingItems, students, studyActivities } from '@/db/schema';
import type { JourneyStage } from '@/db/schema';
import { JOURNEY_STAGES, ONBOARDING_CHECKLIST } from '@/lib/constants';

export function stageIndex(stage: JourneyStage) {
  return JOURNEY_STAGES.indexOf(stage);
}

/**
 * Determina a etapa da jornada a partir dos sinais do aluno.
 * A jornada só avança — regressões são registradas manualmente pelo time.
 */
export function inferStage(signals: {
  current: JourneyStage;
  onboardingPercent: number;
  hasFirstAccess: boolean;
  firstLessonDone: boolean;
  progressPercent: number;
  certificateIssued: boolean;
  daysSinceCertificate: number | null;
  extraEnrollmentsAfterCertificate: number;
  npsLast: number | null;
  activeDaysLast30: number;
}): JourneyStage {
  const {
    current,
    onboardingPercent,
    hasFirstAccess,
    firstLessonDone,
    progressPercent,
    certificateIssued,
    daysSinceCertificate,
    extraEnrollmentsAfterCertificate,
    npsLast,
    activeDaysLast30,
  } = signals;

  let inferred: JourneyStage = 'NOVO';

  if (certificateIssued) {
    inferred = 'CERTIFICADO';
    if (daysSinceCertificate !== null && daysSinceCertificate >= 7) inferred = 'POS_CURSO';
    if (extraEnrollmentsAfterCertificate > 0) inferred = 'EXPANSAO';
    if (npsLast !== null && npsLast >= 9) inferred = 'EMBAIXADOR';
  } else if (progressPercent >= 80) {
    inferred = 'CONCLUINDO';
  } else if (progressPercent >= 25 && activeDaysLast30 >= 4) {
    inferred = 'EM_ACOMPANHAMENTO';
  } else if (firstLessonDone && activeDaysLast30 >= 2) {
    inferred = 'ENGAJAMENTO';
  } else if (firstLessonDone) {
    inferred = 'ATIVACAO';
  } else if (hasFirstAccess) {
    inferred = 'PRIMEIRO_ACESSO';
  } else if (onboardingPercent > 0) {
    inferred = 'ONBOARDING';
  }

  return stageIndex(inferred) > stageIndex(current) ? inferred : current;
}

export async function setStage(
  studentId: string,
  stage: JourneyStage,
  opts: { note?: string; automatic?: boolean } = {},
) {
  const [student] = await db.select().from(students).where(eq(students.id, studentId));
  if (!student || student.stage === stage) return false;

  await db
    .update(students)
    .set({ stage, stageChangedAt: new Date(), updatedAt: new Date() })
    .where(eq(students.id, studentId));

  await db.insert(journeyEvents).values({
    studentId,
    stage,
    fromStage: student.stage,
    note: opts.note ?? null,
    automatic: opts.automatic ?? true,
  });

  return true;
}

export async function ensureOnboardingChecklist(studentId: string) {
  const existing = await db
    .select()
    .from(onboardingItems)
    .where(eq(onboardingItems.studentId, studentId));
  if (existing.length) return existing;

  await db.insert(onboardingItems).values(
    ONBOARDING_CHECKLIST.map((c) => ({
      studentId,
      key: c.key,
      label: c.label,
      order: c.order,
    })),
  );

  return db.select().from(onboardingItems).where(eq(onboardingItems.studentId, studentId));
}

export async function toggleOnboardingItem(itemId: string, done: boolean) {
  const [item] = await db
    .update(onboardingItems)
    .set({ done, doneAt: done ? new Date() : null })
    .where(eq(onboardingItems.id, itemId))
    .returning();
  if (!item) return null;
  await refreshOnboardingPercent(item.studentId);
  return item;
}

export async function refreshOnboardingPercent(studentId: string) {
  const items = await db
    .select()
    .from(onboardingItems)
    .where(eq(onboardingItems.studentId, studentId));
  const percent = items.length ? (items.filter((i) => i.done).length / items.length) * 100 : 0;
  await db
    .update(students)
    .set({ onboardingPercent: percent, updatedAt: new Date() })
    .where(eq(students.id, studentId));
  return percent;
}

export async function getJourney(studentId: string) {
  const [events, items, enrolls] = await Promise.all([
    db
      .select()
      .from(journeyEvents)
      .where(eq(journeyEvents.studentId, studentId))
      .orderBy(desc(journeyEvents.createdAt)),
    db
      .select()
      .from(onboardingItems)
      .where(eq(onboardingItems.studentId, studentId))
      .orderBy(onboardingItems.order),
    db.select().from(enrollments).where(eq(enrollments.studentId, studentId)),
  ]);
  return { events, items, enrolls };
}

export async function stageFunnel() {
  const rows = await db
    .select({ stage: students.stage, total: sql<number>`count(*)::int` })
    .from(students)
    .where(eq(students.active, true))
    .groupBy(students.stage);
  const map = new Map(rows.map((r) => [r.stage, r.total]));
  return JOURNEY_STAGES.map((stage) => ({ stage, total: map.get(stage) ?? 0 }));
}

export async function refreshStageFor(studentId: string) {
  const [student] = await db.select().from(students).where(eq(students.id, studentId));
  if (!student) return null;

  const [items, enrolls, activeDays] = await Promise.all([
    db.select().from(onboardingItems).where(eq(onboardingItems.studentId, studentId)),
    db.select().from(enrollments).where(eq(enrollments.studentId, studentId)),
    db
      .select({ n: sql<number>`count(distinct date(${studyActivities.date}))::int` })
      .from(studyActivities)
      .where(
        and(
          eq(studyActivities.studentId, studentId),
          sql`${studyActivities.date} >= now() - interval '30 days'`,
        ),
      ),
  ]);

  const onboardingPercent = items.length
    ? (items.filter((i) => i.done).length / items.length) * 100
    : 0;
  const certificate = enrolls.find((e) => e.certificateIssuedAt);
  const progress = enrolls.length
    ? enrolls.reduce((s, e) => s + e.progressPercent, 0) / enrolls.length
    : 0;

  const stage = inferStage({
    current: student.stage,
    onboardingPercent,
    hasFirstAccess: Boolean(student.lastAccessAt),
    firstLessonDone: items.find((i) => i.key === 'primeira_aula')?.done ?? false,
    progressPercent: progress,
    certificateIssued: Boolean(certificate),
    daysSinceCertificate: certificate?.certificateIssuedAt
      ? Math.floor((Date.now() - certificate.certificateIssuedAt.getTime()) / 86_400_000)
      : null,
    extraEnrollmentsAfterCertificate: certificate
      ? enrolls.filter(
          (e) =>
            e.id !== certificate.id &&
            e.startedAt.getTime() > (certificate.certificateIssuedAt?.getTime() ?? 0),
        ).length
      : 0,
    npsLast: student.npsLast,
    activeDaysLast30: Number(activeDays[0]?.n ?? 0),
  });

  if (stage !== student.stage) {
    await setStage(studentId, stage, { automatic: true, note: 'Atualização automática da jornada' });
  }
  return stage;
}
