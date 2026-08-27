import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  alerts,
  enrollments,
  payments,
  students,
  surveyResponses,
  tickets,
  studyActivities,
} from '@/db/schema';
import type { HealthInput } from '@/lib/health-score';

const DAY = 86_400_000;

type AlertType =
  | 'SEM_ACESSO_7D'
  | 'CRONOGRAMA_ATRASADO'
  | 'QUEDA_HEALTH_SCORE'
  | 'NPS_BAIXO'
  | 'CSAT_BAIXO'
  | 'PAGAMENTO_ATRASADO'
  | 'BAIXO_ENGAJAMENTO'
  | 'POUCA_PARTICIPACAO'
  | 'RECLAMACAO_RECORRENTE'
  | 'RISCO_EVASAO';

type Severity = 'INFO' | 'ATENCAO' | 'ALTA' | 'CRITICA';

interface Candidate {
  type: AlertType;
  severity: Severity;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Regras dos alertas inteligentes. Recebe os sinais já calculados
 * do aluno e devolve os alertas que devem estar abertos agora.
 */
export function evaluateAlertRules(ctx: {
  studentName: string;
  input: HealthInput;
  score: number;
  previousScore: number | null;
  churnRisk: number;
  openComplaints: number;
  daysBehindSchedule: number;
}): Candidate[] {
  const out: Candidate[] = [];
  const { input } = ctx;

  if (input.daysWithoutAccess >= 7) {
    out.push({
      type: 'SEM_ACESSO_7D',
      severity: input.daysWithoutAccess >= 21 ? 'CRITICA' : input.daysWithoutAccess >= 14 ? 'ALTA' : 'ATENCAO',
      title: `${input.daysWithoutAccess} dias sem acessar a plataforma`,
      description: `${ctx.studentName} não acessa a plataforma há ${input.daysWithoutAccess} dias. Acione contato ativo pelo WhatsApp e reavalie o cronograma.`,
      metadata: { daysWithoutAccess: input.daysWithoutAccess },
    });
  }

  if (input.progressPercent < input.expectedProgressPercent - 15) {
    const gap = Math.round(input.expectedProgressPercent - input.progressPercent);
    out.push({
      type: 'CRONOGRAMA_ATRASADO',
      severity: gap >= 35 ? 'ALTA' : 'ATENCAO',
      title: `Cronograma atrasado em ${gap} p.p.`,
      description: `Progresso de ${Math.round(input.progressPercent)}% contra ${Math.round(
        input.expectedProgressPercent,
      )}% esperados. Reprograme metas semanais e ofereça mentoria de recuperação.`,
      metadata: { gap },
    });
  }

  if (ctx.previousScore !== null && ctx.score < ctx.previousScore - 10) {
    out.push({
      type: 'QUEDA_HEALTH_SCORE',
      severity: ctx.previousScore - ctx.score >= 20 ? 'ALTA' : 'ATENCAO',
      title: `Health Score caiu ${ctx.previousScore - ctx.score} pontos`,
      description: `A nota passou de ${ctx.previousScore} para ${ctx.score}. Verifique o detalhamento por indicador e registre um plano de ação.`,
      metadata: { from: ctx.previousScore, to: ctx.score },
    });
  }

  if (input.npsLast !== null && input.npsLast <= 6) {
    out.push({
      type: 'NPS_BAIXO',
      severity: input.npsLast <= 4 ? 'ALTA' : 'ATENCAO',
      title: `NPS detrator (${input.npsLast})`,
      description: `Última nota de NPS foi ${input.npsLast}. Faça contato de recuperação em até 48h e registre a tratativa.`,
      metadata: { nps: input.npsLast },
    });
  }

  if (input.csatLast !== null && input.csatLast <= 3) {
    out.push({
      type: 'CSAT_BAIXO',
      severity: input.csatLast <= 2 ? 'ALTA' : 'ATENCAO',
      title: `CSAT baixo (${input.csatLast}/5)`,
      description: `A última avaliação de atendimento foi ${input.csatLast} de 5. Reveja o atendimento e retorne ao aluno.`,
      metadata: { csat: input.csatLast },
    });
  }

  if (input.paymentStatus === 'ATRASADO' || input.paymentStatus === 'INADIMPLENTE') {
    out.push({
      type: 'PAGAMENTO_ATRASADO',
      severity: input.paymentStatus === 'INADIMPLENTE' ? 'CRITICA' : 'ALTA',
      title: `Financeiro: ${input.overduePayments} parcela(s) em atraso`,
      description: `Situação financeira ${input.paymentStatus.toLowerCase()}. Alinhe com o time financeiro antes de qualquer ação de retenção.`,
      metadata: { overduePayments: input.overduePayments },
    });
  }

  if (input.lessonsLast30 <= 2 && input.daysWithoutAccess < 7) {
    out.push({
      type: 'BAIXO_ENGAJAMENTO',
      severity: 'ATENCAO',
      title: 'Baixo engajamento nas aulas',
      description: `Apenas ${input.lessonsLast30} aula(s) concluída(s) nos últimos 30 dias, mesmo com acessos recentes.`,
      metadata: { lessonsLast30: input.lessonsLast30 },
    });
  }

  if (input.mentorshipsOffered >= 2 && input.mentorshipsAttended === 0) {
    out.push({
      type: 'POUCA_PARTICIPACAO',
      severity: 'ATENCAO',
      title: 'Não participa das mentorias',
      description: `${input.mentorshipsOffered} mentorias oferecidas e nenhuma presença registrada nos últimos 60 dias.`,
      metadata: { offered: input.mentorshipsOffered },
    });
  }

  if (ctx.openComplaints >= 2) {
    out.push({
      type: 'RECLAMACAO_RECORRENTE',
      severity: 'ALTA',
      title: `${ctx.openComplaints} reclamações em aberto`,
      description: 'Reclamações recorrentes registradas. Escale para o Coordenador CSCX.',
      metadata: { openComplaints: ctx.openComplaints },
    });
  }

  if (ctx.churnRisk >= 70) {
    out.push({
      type: 'RISCO_EVASAO',
      severity: ctx.churnRisk >= 85 ? 'CRITICA' : 'ALTA',
      title: `Risco de evasão em ${ctx.churnRisk}%`,
      description:
        'A combinação de sinais indica alta probabilidade de evasão. Um plano de recuperação deve ser aberto imediatamente.',
      metadata: { churnRisk: ctx.churnRisk },
    });
  }

  return out;
}

/** Sincroniza os alertas abertos de um aluno com o resultado das regras. */
export async function syncStudentAlerts(
  studentId: string,
  candidates: Candidate[],
): Promise<{ created: number; resolved: number }> {
  const open = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.studentId, studentId), inArray(alerts.status, ['ABERTO', 'EM_TRATATIVA'])));

  const openByType = new Map(open.map((a) => [a.type, a]));
  let created = 0;
  let resolved = 0;

  for (const c of candidates) {
    const existing = openByType.get(c.type);
    if (existing) {
      if (
        existing.title !== c.title ||
        existing.severity !== c.severity ||
        existing.description !== c.description
      ) {
        await db
          .update(alerts)
          .set({
            title: c.title,
            description: c.description,
            severity: c.severity,
            metadata: (c.metadata as never) ?? null,
            updatedAt: new Date(),
          })
          .where(eq(alerts.id, existing.id));
      }
      openByType.delete(c.type);
    } else {
      await db.insert(alerts).values({
        studentId,
        type: c.type,
        severity: c.severity,
        title: c.title,
        description: c.description,
        metadata: (c.metadata as never) ?? null,
      });
      created += 1;
    }
  }

  // Alertas que não têm mais razão de existir são resolvidos automaticamente.
  for (const stale of openByType.values()) {
    await db
      .update(alerts)
      .set({ status: 'RESOLVIDO', resolvedAt: new Date(), updatedAt: new Date() })
      .where(eq(alerts.id, stale.id));
    resolved += 1;
  }

  return { created, resolved };
}

export async function countOpenComplaints(studentId: string) {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tickets)
    .where(
      and(
        eq(tickets.studentId, studentId),
        inArray(tickets.status, ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO_ALUNO']),
        sql`lower(${tickets.category}) like '%reclama%'`,
      ),
    );
  return rows[0]?.n ?? 0;
}

export async function listAlerts(filter: {
  status?: string[];
  severity?: string[];
  ownerId?: string;
  limit?: number;
} = {}) {
  const conditions = [] as ReturnType<typeof eq>[];
  if (filter.status?.length) conditions.push(inArray(alerts.status, filter.status as never) as never);
  if (filter.severity?.length)
    conditions.push(inArray(alerts.severity, filter.severity as never) as never);
  if (filter.ownerId) conditions.push(eq(students.ownerId, filter.ownerId));

  return db
    .select({
      alert: alerts,
      student: {
        id: students.id,
        name: students.name,
        code: students.code,
        healthScore: students.healthScore,
        healthBand: students.healthBand,
        ownerId: students.ownerId,
      },
    })
    .from(alerts)
    .innerJoin(students, eq(alerts.studentId, students.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(alerts.createdAt))
    .limit(filter.limit ?? 200);
}

export async function daysBehindSchedule(studentId: string) {
  const rows = await db.select().from(enrollments).where(eq(enrollments.studentId, studentId));
  const now = Date.now();
  let worst = 0;
  for (const e of rows) {
    if (!e.expectedFinishAt) continue;
    const total = e.expectedFinishAt.getTime() - e.startedAt.getTime();
    if (total <= 0) continue;
    const expected = Math.min(100, ((now - e.startedAt.getTime()) / total) * 100);
    const gapPercent = expected - e.progressPercent;
    if (gapPercent <= 0) continue;
    worst = Math.max(worst, Math.round((gapPercent / 100) * (total / DAY)));
  }
  return worst;
}

export async function recentActivityDays(studentId: string, days = 30) {
  const since = new Date(Date.now() - days * DAY);
  const rows = await db
    .select({ d: studyActivities.date })
    .from(studyActivities)
    .where(and(eq(studyActivities.studentId, studentId), gte(studyActivities.date, since)));
  return new Set(rows.map((r) => r.d.toISOString().slice(0, 10))).size;
}

export async function latestSurveys(studentId: string) {
  return db
    .select()
    .from(surveyResponses)
    .where(eq(surveyResponses.studentId, studentId))
    .orderBy(desc(surveyResponses.createdAt))
    .limit(10);
}

export async function overduePaymentsFor(studentId: string) {
  const rows = await db.select().from(payments).where(eq(payments.studentId, studentId));
  const now = Date.now();
  return rows.filter((p) => !p.paidAt && p.dueAt.getTime() < now);
}
