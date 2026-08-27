import { and, count, eq, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  alerts,
  courses,
  enrollments,
  interactions,
  mentorshipAttendances,
  payments,
  students,
  studyActivities,
  tasks,
  tickets,
} from '@/db/schema';
import { getCsatSummary, getNpsSummary, getNpsTrend } from './survey-service';
import { stageFunnel } from './journey-service';

const DAY = 86_400_000;

export interface ExecutiveMetrics {
  totalStudents: number;
  activeStudents: number;
  atRiskStudents: number;
  avgHealthScore: number;
  nps: number;
  npsTotal: number;
  csat: number;
  csatTotal: number;
  completionRate: number;
  churnRate: number;
  retentionRate: number;
  avgResponseMinutes: number;
  revenuePerStudent: number;
  mrr: number;
  totalRevenue: number;
  ltv: number;
  openAlerts: number;
  criticalAlerts: number;
  overdueTasks: number;
  avgOnboarding: number;
  avgProgress: number;
  certificatesIssued: number;
  avgChurnRisk: number;
}

export async function getExecutiveMetrics(): Promise<ExecutiveMetrics> {
  const [
    totals,
    healthAgg,
    riskAgg,
    enrollAgg,
    respAgg,
    revenueAgg,
    alertAgg,
    taskAgg,
    npsSummary,
    csatSummary,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${students.active})::int`,
        avgHealth: sql<number>`coalesce(avg(${students.healthScore}), 0)`,
        avgOnboarding: sql<number>`coalesce(avg(${students.onboardingPercent}), 0)`,
        avgProgress: sql<number>`coalesce(avg(${students.progressPercent}), 0)`,
        avgChurn: sql<number>`coalesce(avg(${students.churnRisk}), 0)`,
        mrr: sql<number>`coalesce(sum(${students.mrr}), 0)`,
        ltv: sql<number>`coalesce(avg(${students.ltv}), 0)`,
      })
      .from(students),
    db
      .select({ avgHealth: sql<number>`coalesce(avg(${students.healthScore}), 0)` })
      .from(students)
      .where(eq(students.active, true)),
    db
      .select({ total: count() })
      .from(students)
      .where(and(eq(students.active, true), inArray(students.healthBand, ['RISCO', 'CRITICO']))),
    db
      .select({
        total: count(),
        concluded: sql<number>`count(*) filter (where ${enrollments.status} = 'CONCLUIDA')::int`,
        cancelled: sql<number>`count(*) filter (where ${enrollments.status} = 'CANCELADA')::int`,
        certificates: sql<number>`count(*) filter (where ${enrollments.certificateIssuedAt} is not null)::int`,
        revenue: sql<number>`coalesce(sum(${enrollments.value}), 0)`,
      })
      .from(enrollments),
    db
      .select({ avgMinutes: sql<number>`coalesce(avg(${interactions.responseMinutes}), 0)` })
      .from(interactions)
      .where(isNotNull(interactions.responseMinutes)),
    db
      .select({ paid: sql<number>`coalesce(sum(${payments.amount}) filter (where ${payments.paidAt} is not null), 0)` })
      .from(payments),
    db
      .select({
        open: sql<number>`count(*) filter (where ${alerts.status} in ('ABERTO','EM_TRATATIVA'))::int`,
        critical: sql<number>`count(*) filter (where ${alerts.status} in ('ABERTO','EM_TRATATIVA') and ${alerts.severity} = 'CRITICA')::int`,
      })
      .from(alerts),
    db
      .select({ overdue: count() })
      .from(tasks)
      .where(and(inArray(tasks.status, ['ABERTA', 'EM_ANDAMENTO']), lt(tasks.dueAt, new Date()))),
    getNpsSummary(),
    getCsatSummary(),
  ]);

  const t = totals[0];
  const e = enrollAgg[0];
  const closed = Number(e.concluded) + Number(e.cancelled);
  const churnRate = closed ? (Number(e.cancelled) / closed) * 100 : 0;
  const completionRate = Number(e.total) ? (Number(e.concluded) / Number(e.total)) * 100 : 0;
  const totalRevenue = Number(revenueAgg[0].paid) || Number(e.revenue);
  const activeStudents = Number(t.active);

  return {
    totalStudents: Number(t.total),
    activeStudents,
    atRiskStudents: Number(riskAgg[0].total),
    avgHealthScore: Math.round(Number(healthAgg[0].avgHealth)),
    nps: npsSummary.nps,
    npsTotal: npsSummary.total,
    csat: csatSummary.average,
    csatTotal: csatSummary.total,
    completionRate: Math.round(completionRate * 10) / 10,
    churnRate: Math.round(churnRate * 10) / 10,
    retentionRate: Math.round((100 - churnRate) * 10) / 10,
    avgResponseMinutes: Math.round(Number(respAgg[0].avgMinutes)),
    revenuePerStudent: Number(t.total) ? Math.round(totalRevenue / Number(t.total)) : 0,
    mrr: Math.round(Number(t.mrr)),
    totalRevenue: Math.round(totalRevenue),
    ltv: Math.round(Number(t.ltv)),
    openAlerts: Number(alertAgg[0].open),
    criticalAlerts: Number(alertAgg[0].critical),
    overdueTasks: Number(taskAgg[0].overdue),
    avgOnboarding: Math.round(Number(t.avgOnboarding)),
    avgProgress: Math.round(Number(t.avgProgress)),
    certificatesIssued: Number(e.certificates),
    avgChurnRisk: Math.round(Number(t.avgChurn)),
  };
}

export async function getMonthlyEvolution(months = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const [enrolled, concluded, cancelled] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(${students.enrolledAt}, 'YYYY-MM')`,
        total: sql<number>`count(*)::int`,
      })
      .from(students)
      .where(gte(students.enrolledAt, since))
      .groupBy(sql`to_char(${students.enrolledAt}, 'YYYY-MM')`),
    db
      .select({
        month: sql<string>`to_char(${enrollments.finishedAt}, 'YYYY-MM')`,
        total: sql<number>`count(*)::int`,
      })
      .from(enrollments)
      .where(and(eq(enrollments.status, 'CONCLUIDA'), gte(enrollments.finishedAt, since)))
      .groupBy(sql`to_char(${enrollments.finishedAt}, 'YYYY-MM')`),
    db
      .select({
        month: sql<string>`to_char(${enrollments.finishedAt}, 'YYYY-MM')`,
        total: sql<number>`count(*)::int`,
      })
      .from(enrollments)
      .where(and(eq(enrollments.status, 'CANCELADA'), gte(enrollments.finishedAt, since)))
      .groupBy(sql`to_char(${enrollments.finishedAt}, 'YYYY-MM')`),
  ]);

  const idx = (rows: { month: string | null; total: number }[]) =>
    new Map(rows.filter((r) => r.month).map((r) => [r.month as string, r.total]));

  const en = idx(enrolled);
  const co = idx(concluded);
  const ca = idx(cancelled);

  const labels = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const out = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(since);
    d.setMonth(since.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({
      month: key,
      label: `${labels[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      matriculas: en.get(key) ?? 0,
      conclusoes: co.get(key) ?? 0,
      cancelamentos: ca.get(key) ?? 0,
    });
  }
  return out;
}

export async function getHealthTrend(months = 6) {
  const rows = await db.execute(sql`
    select to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
           round(avg(score))::int as score,
           round(avg(churn_risk))::int as churn
    from health_snapshots
    where created_at >= now() - interval '${sql.raw(String(months))} months'
    group by 1
    order by 1
  `);
  return (rows as unknown as { month: string; score: number; churn: number }[]).map((r) => ({
    month: r.month,
    score: Number(r.score),
    churn: Number(r.churn),
  }));
}

export async function getCoursePerformance() {
  const rows = await db
    .select({
      courseId: courses.id,
      course: courses.name,
      category: courses.category,
      alunos: sql<number>`count(${enrollments.id})::int`,
      progresso: sql<number>`coalesce(avg(${enrollments.progressPercent}), 0)`,
      concluidos: sql<number>`count(*) filter (where ${enrollments.status} = 'CONCLUIDA')::int`,
      cancelados: sql<number>`count(*) filter (where ${enrollments.status} = 'CANCELADA')::int`,
      receita: sql<number>`coalesce(sum(${enrollments.value}), 0)`,
      health: sql<number>`coalesce(avg(${students.healthScore}), 0)`,
    })
    .from(courses)
    .leftJoin(enrollments, eq(enrollments.courseId, courses.id))
    .leftJoin(students, eq(enrollments.studentId, students.id))
    .groupBy(courses.id, courses.name, courses.category)
    .orderBy(sql`count(${enrollments.id}) desc`);

  return rows.map((r) => ({
    ...r,
    progresso: Math.round(Number(r.progresso)),
    health: Math.round(Number(r.health)),
    receita: Number(r.receita),
    conclusao: r.alunos ? Math.round((Number(r.concluidos) / Number(r.alunos)) * 100) : 0,
  }));
}

export async function getOperationalMetrics(ownerId?: string) {
  const ownerFilter = ownerId ? eq(students.ownerId, ownerId) : undefined;

  const [carteira, alertRows, taskRows, ticketRows, mentoriaRows] = await Promise.all([
    db
      .select({
        total: count(),
        risco: sql<number>`count(*) filter (where ${students.healthBand} in ('RISCO','CRITICO'))::int`,
        atencao: sql<number>`count(*) filter (where ${students.healthBand} = 'ATENCAO')::int`,
        saudavel: sql<number>`count(*) filter (where ${students.healthBand} in ('SAUDAVEL','EXCELENTE'))::int`,
        semAcesso7: sql<number>`count(*) filter (where ${students.daysWithoutAccess} >= 7)::int`,
        onboardingIncompleto: sql<number>`count(*) filter (where ${students.onboardingPercent} < 100)::int`,
      })
      .from(students)
      .where(ownerFilter ? and(eq(students.active, true), ownerFilter) : eq(students.active, true)),
    db
      .select({
        severity: alerts.severity,
        total: sql<number>`count(*)::int`,
      })
      .from(alerts)
      .innerJoin(students, eq(alerts.studentId, students.id))
      .where(
        ownerFilter
          ? and(inArray(alerts.status, ['ABERTO', 'EM_TRATATIVA']), ownerFilter)
          : inArray(alerts.status, ['ABERTO', 'EM_TRATATIVA']),
      )
      .groupBy(alerts.severity),
    db
      .select({
        status: tasks.status,
        total: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .where(ownerId ? eq(tasks.ownerId, ownerId) : undefined)
      .groupBy(tasks.status),
    db
      .select({ status: tickets.status, total: sql<number>`count(*)::int` })
      .from(tickets)
      .groupBy(tickets.status),
    db
      .select({
        oferecidas: count(),
        presentes: sql<number>`count(*) filter (where ${mentorshipAttendances.attended})::int`,
      })
      .from(mentorshipAttendances)
      .where(gte(mentorshipAttendances.date, new Date(Date.now() - 60 * DAY))),
  ]);

  return {
    carteira: carteira[0],
    alerts: alertRows,
    tasks: taskRows,
    tickets: ticketRows,
    mentorias: mentoriaRows[0],
  };
}

export async function getEngagementSeries(days = 30) {
  const rows = await db.execute(sql`
    select to_char(date, 'YYYY-MM-DD') as day,
           sum(minutes)::int as minutos,
           sum(lessons_done)::int as aulas,
           count(distinct student_id)::int as alunos
    from study_activities
    where date >= now() - interval '${sql.raw(String(days))} days'
    group by 1
    order by 1
  `);
  return (rows as unknown as { day: string; minutos: number; aulas: number; alunos: number }[]).map(
    (r) => ({
      day: r.day,
      label: r.day.slice(8) + '/' + r.day.slice(5, 7),
      minutos: Number(r.minutos),
      horas: Math.round((Number(r.minutos) / 60) * 10) / 10,
      aulas: Number(r.aulas),
      alunos: Number(r.alunos),
    }),
  );
}

export async function getDashboardBundle() {
  const [metrics, evolution, funnel, npsTrend, courses, engagement, healthTrend, csat] =
    await Promise.all([
      getExecutiveMetrics(),
      getMonthlyEvolution(),
      stageFunnel(),
      getNpsTrend(),
      getCoursePerformance(),
      getEngagementSeries(),
      getHealthTrend(),
      getCsatSummary(),
    ]);
  return { metrics, evolution, funnel, npsTrend, courses, engagement, healthTrend, csat };
}
