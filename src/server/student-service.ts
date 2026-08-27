import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  actionPlans,
  alerts,
  classGroups,
  courses,
  enrollments,
  healthSnapshots,
  interactions,
  journeyEvents,
  mentorshipAttendances,
  onboardingItems,
  payments,
  students,
  studyActivities,
  surveyResponses,
  tasks,
  tickets,
  users,
  type ActionPlan,
  type Alert,
  type Course,
  type Enrollment,
  type Interaction,
  type JourneyEvent,
  type OnboardingItem,
  type Payment,
  type Student,
  type SurveyResponse,
  type Task,
  type Ticket,
} from '@/db/schema';
import { computeHealthScore, explainScore, type HealthResult } from '@/lib/health-score';
import { buildHealthInput, getHealthConfig } from './health-service';

export interface StudentListFilters {
  search?: string;
  stage?: string[];
  band?: string[];
  ownerId?: string;
  courseId?: string;
  paymentStatus?: string[];
  onlyAtRisk?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'health' | 'name' | 'risk' | 'recent';
}

export async function listStudents(filters: StudentListFilters = {}) {
  const conditions = [eq(students.active, true)];

  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(students.name, term),
        ilike(students.email, term),
        ilike(students.code, term),
      ) as never,
    );
  }
  if (filters.stage?.length) conditions.push(inArray(students.stage, filters.stage as never));
  if (filters.band?.length) conditions.push(inArray(students.healthBand, filters.band as never));
  if (filters.ownerId) conditions.push(eq(students.ownerId, filters.ownerId));
  if (filters.paymentStatus?.length)
    conditions.push(inArray(students.paymentStatus, filters.paymentStatus as never));
  if (filters.onlyAtRisk) conditions.push(inArray(students.healthBand, ['RISCO', 'CRITICO']));

  const order =
    filters.orderBy === 'name'
      ? asc(students.name)
      : filters.orderBy === 'risk'
        ? desc(students.churnRisk)
        : filters.orderBy === 'recent'
          ? desc(students.enrolledAt)
          : asc(students.healthScore);

  const rows = await db
    .select({
      student: students,
      owner: { id: users.id, name: users.name, avatarColor: users.avatarColor },
      openAlerts: sql<number>`(select count(*)::int from alerts a where a.student_id = ${students.id} and a.status in ('ABERTO','EM_TRATATIVA'))`,
      course: sql<string>`(select c.name from enrollments e join courses c on c.id = e.course_id where e.student_id = ${students.id} order by e.started_at desc limit 1)`,
    })
    .from(students)
    .leftJoin(users, eq(students.ownerId, users.id))
    .where(and(...conditions))
    .orderBy(order)
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(students)
    .where(and(...conditions));

  return { rows, total: Number(total) };
}

export interface Student360 {
  student: Student;
  owner: { id: string; name: string; avatarColor: string } | null;
  mentor: { id: string; name: string; avatarColor: string } | null;
  enrollments: { enrollment: Enrollment; course: Course | null; classGroup: { name: string } | null }[];
  onboarding: OnboardingItem[];
  journey: JourneyEvent[];
  alerts: Alert[];
  interactions: Interaction[];
  surveys: SurveyResponse[];
  tasks: Task[];
  actionPlans: ActionPlan[];
  tickets: Ticket[];
  payments: Payment[];
  activities: { day: string; minutos: number; aulas: number }[];
  mentorships: { title: string; date: Date; attended: boolean }[];
  healthHistory: { date: string; score: number; churn: number }[];
  healthResult: HealthResult | null;
  healthExplanation: string | null;
}

export async function getStudent360(studentId: string): Promise<Student360 | null> {
  const [student] = await db.select().from(students).where(eq(students.id, studentId));
  if (!student) return null;

  const [
    ownerRow,
    mentorRow,
    enrollRows,
    onboardingRows,
    journeyRows,
    alertRows,
    interactionRows,
    surveyRows,
    taskRows,
    planRows,
    ticketRows,
    paymentRows,
    activityRows,
    mentorshipRows,
    healthRows,
  ] = await Promise.all([
    student.ownerId
      ? db
          .select({ id: users.id, name: users.name, avatarColor: users.avatarColor })
          .from(users)
          .where(eq(users.id, student.ownerId))
      : Promise.resolve([]),
    student.mentorId
      ? db
          .select({ id: users.id, name: users.name, avatarColor: users.avatarColor })
          .from(users)
          .where(eq(users.id, student.mentorId))
      : Promise.resolve([]),
    db
      .select({
        enrollment: enrollments,
        course: courses,
        classGroup: { name: classGroups.name },
      })
      .from(enrollments)
      .leftJoin(courses, eq(enrollments.courseId, courses.id))
      .leftJoin(classGroups, eq(enrollments.classGroupId, classGroups.id))
      .where(eq(enrollments.studentId, studentId)),
    db
      .select()
      .from(onboardingItems)
      .where(eq(onboardingItems.studentId, studentId))
      .orderBy(asc(onboardingItems.order)),
    db
      .select()
      .from(journeyEvents)
      .where(eq(journeyEvents.studentId, studentId))
      .orderBy(desc(journeyEvents.createdAt))
      .limit(40),
    db
      .select()
      .from(alerts)
      .where(and(eq(alerts.studentId, studentId), inArray(alerts.status, ['ABERTO', 'EM_TRATATIVA'])))
      .orderBy(desc(alerts.createdAt)),
    db
      .select()
      .from(interactions)
      .where(eq(interactions.studentId, studentId))
      .orderBy(desc(interactions.createdAt))
      .limit(50),
    db
      .select()
      .from(surveyResponses)
      .where(eq(surveyResponses.studentId, studentId))
      .orderBy(desc(surveyResponses.createdAt))
      .limit(30),
    db
      .select()
      .from(tasks)
      .where(eq(tasks.studentId, studentId))
      .orderBy(desc(tasks.createdAt))
      .limit(40),
    db
      .select()
      .from(actionPlans)
      .where(eq(actionPlans.studentId, studentId))
      .orderBy(desc(actionPlans.createdAt)),
    db
      .select()
      .from(tickets)
      .where(eq(tickets.studentId, studentId))
      .orderBy(desc(tickets.createdAt))
      .limit(20),
    db
      .select()
      .from(payments)
      .where(eq(payments.studentId, studentId))
      .orderBy(desc(payments.dueAt))
      .limit(24),
    db
      .select({
        day: sql<string>`to_char(${studyActivities.date}, 'YYYY-MM-DD')`,
        minutos: sql<number>`sum(${studyActivities.minutes})::int`,
        aulas: sql<number>`sum(${studyActivities.lessonsDone})::int`,
      })
      .from(studyActivities)
      .where(
        and(
          eq(studyActivities.studentId, studentId),
          sql`${studyActivities.date} >= now() - interval '90 days'`,
        ),
      )
      .groupBy(sql`to_char(${studyActivities.date}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${studyActivities.date}, 'YYYY-MM-DD')`),
    db
      .select({
        title: mentorshipAttendances.title,
        date: mentorshipAttendances.date,
        attended: mentorshipAttendances.attended,
      })
      .from(mentorshipAttendances)
      .where(eq(mentorshipAttendances.studentId, studentId))
      .orderBy(desc(mentorshipAttendances.date))
      .limit(12),
    db
      .select()
      .from(healthSnapshots)
      .where(eq(healthSnapshots.studentId, studentId))
      .orderBy(desc(healthSnapshots.createdAt))
      .limit(30),
  ]);

  const input = await buildHealthInput(studentId);
  const { weights, thresholds } = await getHealthConfig();
  const healthResult = input ? computeHealthScore(input, weights, thresholds) : null;

  return {
    student,
    owner: ownerRow[0] ?? null,
    mentor: mentorRow[0] ?? null,
    enrollments: enrollRows,
    onboarding: onboardingRows,
    journey: journeyRows,
    alerts: alertRows,
    interactions: interactionRows,
    surveys: surveyRows,
    tasks: taskRows,
    actionPlans: planRows,
    tickets: ticketRows,
    payments: paymentRows,
    activities: activityRows.map((a) => ({
      day: a.day,
      minutos: Number(a.minutos),
      aulas: Number(a.aulas),
    })),
    mentorships: mentorshipRows,
    healthHistory: healthRows
      .slice()
      .reverse()
      .map((h) => ({
        date: h.createdAt.toISOString().slice(0, 10),
        score: h.score,
        churn: h.churnRisk,
      })),
    healthResult,
    healthExplanation: healthResult ? explainScore(healthResult) : null,
  };
}

export async function getStudentByUserId(userId: string) {
  const [row] = await db.select().from(students).where(eq(students.userId, userId));
  return row ?? null;
}

/** Métricas de estudo consolidadas para a ficha do aluno. */
export function studySummary(s: Student360) {
  const last30 = s.activities.filter(
    (a) => new Date(a.day).getTime() >= Date.now() - 30 * 86_400_000,
  );
  const minutos30 = last30.reduce((sum, a) => sum + a.minutos, 0);
  const activeDays = last30.filter((a) => a.minutos > 0).length;
  const active = s.enrollments.filter((e) => e.enrollment.status !== 'CANCELADA');
  const progresso = active.length
    ? active.reduce((sum, e) => sum + e.enrollment.progressPercent, 0) / active.length
    : 0;
  const previsao = active
    .map((e) => e.enrollment.expectedFinishAt)
    .filter(Boolean)
    .sort((a, b) => (a as Date).getTime() - (b as Date).getTime())[0] as Date | undefined;

  return {
    horasTotais: Math.round((s.activities.reduce((sum, a) => sum + a.minutos, 0) / 60) * 10) / 10,
    horas30: Math.round((minutos30 / 60) * 10) / 10,
    diasAtivos30: activeDays,
    mediaDiaria: activeDays ? Math.round(minutos30 / activeDays) : 0,
    aulas30: last30.reduce((sum, a) => sum + a.aulas, 0),
    progresso: Math.round(progresso),
    moduloAtual: active[0]?.enrollment.currentModule ?? '—',
    atividades: `${active.reduce((s2, e) => s2 + e.enrollment.activitiesDone, 0)}/${active.reduce(
      (s2, e) => s2 + e.enrollment.activitiesTotal,
      0,
    )}`,
    media: (() => {
      const g = active.map((e) => e.enrollment.gradeAverage).filter((x): x is number => x !== null);
      return g.length ? Math.round((g.reduce((a, b) => a + b, 0) / g.length) * 10) / 10 : null;
    })(),
    mentoriasAssistidas: s.mentorships.filter((m) => m.attended).length,
    mentoriasOferecidas: s.mentorships.length,
    previsaoConclusao: previsao ?? null,
    metaSemanal: s.student.weeklyGoalHours,
    metaMensal: s.student.monthlyGoalHours,
    aderenciaSemanal: s.student.weeklyGoalHours
      ? Math.min(
          100,
          Math.round(
            ((last30.slice(-7).reduce((sum, a) => sum + a.minutos, 0) / 60) /
              s.student.weeklyGoalHours) *
              100,
          ),
        )
      : 0,
  };
}
