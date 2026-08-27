import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { students, surveyResponses } from '@/db/schema';

export const NPS_QUESTION =
  'De 0 a 10, quanto você recomendaria a Escola Instructiva para um amigo?';

export const CSAT_QUESTIONS: Record<string, string> = {
  ATENDIMENTO: 'Como você avalia o atendimento que acabou de receber?',
  MENTORIA: 'Como você avalia a mentoria de hoje?',
  ONBOARDING: 'Como você avalia sua experiência de entrada na Escola Instructiva?',
  CONCLUSAO: 'Como você avalia sua experiência geral no curso que acabou de concluir?',
  MANUAL: 'Como você avalia sua experiência?',
};

export function classifyNps(score: number): 'PROMOTOR' | 'NEUTRO' | 'DETRATOR' {
  if (score >= 9) return 'PROMOTOR';
  if (score >= 7) return 'NEUTRO';
  return 'DETRATOR';
}

export interface NpsSummary {
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
}

export function summarizeNps(scores: number[]): NpsSummary {
  const total = scores.length;
  if (!total) {
    return {
      total: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      nps: 0,
      promoterPct: 0,
      passivePct: 0,
      detractorPct: 0,
    };
  }
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  const passives = total - promoters - detractors;
  const promoterPct = (promoters / total) * 100;
  const detractorPct = (detractors / total) * 100;
  return {
    total,
    promoters,
    passives,
    detractors,
    nps: Math.round(promoterPct - detractorPct),
    promoterPct: Math.round(promoterPct),
    passivePct: Math.round((passives / total) * 100),
    detractorPct: Math.round(detractorPct),
  };
}

export async function getNpsSummary(sinceDays?: number): Promise<NpsSummary> {
  const conditions = [eq(surveyResponses.type, 'NPS'), eq(surveyResponses.status, 'RESPONDIDA')];
  if (sinceDays) {
    conditions.push(gte(surveyResponses.answeredAt, new Date(Date.now() - sinceDays * 86_400_000)));
  }
  const rows = await db
    .select({ score: surveyResponses.score })
    .from(surveyResponses)
    .where(and(...conditions));
  return summarizeNps(rows.map((r) => r.score ?? 0));
}

export async function getCsatSummary(sinceDays?: number) {
  const conditions = [eq(surveyResponses.type, 'CSAT'), eq(surveyResponses.status, 'RESPONDIDA')];
  if (sinceDays) {
    conditions.push(gte(surveyResponses.answeredAt, new Date(Date.now() - sinceDays * 86_400_000)));
  }
  const rows = await db
    .select({ score: surveyResponses.score })
    .from(surveyResponses)
    .where(and(...conditions));
  const scores = rows.map((r) => r.score ?? 0).filter(Boolean);
  const total = scores.length;
  const average = total ? scores.reduce((a, b) => a + b, 0) / total : 0;
  const satisfied = scores.filter((s) => s >= 4).length;
  return {
    total,
    average: Math.round(average * 100) / 100,
    satisfactionRate: total ? Math.round((satisfied / total) * 100) : 0,
    distribution: [1, 2, 3, 4, 5].map((star) => ({
      star,
      total: scores.filter((s) => s === star).length,
    })),
  };
}

export async function getNpsTrend(months = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      month: sql<string>`to_char(${surveyResponses.answeredAt}, 'YYYY-MM')`,
      score: surveyResponses.score,
    })
    .from(surveyResponses)
    .where(
      and(
        eq(surveyResponses.type, 'NPS'),
        eq(surveyResponses.status, 'RESPONDIDA'),
        gte(surveyResponses.answeredAt, since),
      ),
    );

  const byMonth = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.month) continue;
    const list = byMonth.get(r.month) ?? [];
    list.push(r.score ?? 0);
    byMonth.set(r.month, list);
  }

  const out: { month: string; nps: number; respostas: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(since);
    d.setMonth(since.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const scores = byMonth.get(key) ?? [];
    out.push({ month: key, nps: summarizeNps(scores).nps, respostas: scores.length });
  }
  return out;
}

export async function createSurvey(input: {
  studentId: string;
  type: 'NPS' | 'CSAT';
  trigger:
    | 'ONBOARDING'
    | 'ATENDIMENTO'
    | 'MENTORIA'
    | 'CONCLUSAO'
    | 'D30'
    | 'D60'
    | 'D90'
    | 'MANUAL';
  contextRef?: string | null;
  send?: boolean;
}) {
  const [row] = await db
    .insert(surveyResponses)
    .values({
      studentId: input.studentId,
      type: input.type,
      trigger: input.trigger,
      contextRef: input.contextRef ?? null,
      status: input.send === false ? 'PENDENTE' : 'ENVIADA',
      sentAt: input.send === false ? null : new Date(),
    })
    .returning();
  return row;
}

export async function answerSurvey(id: string, score: number, comment?: string | null) {
  const [survey] = await db.select().from(surveyResponses).where(eq(surveyResponses.id, id));
  if (!survey) return null;

  const [row] = await db
    .update(surveyResponses)
    .set({
      score,
      npsClass: survey.type === 'NPS' ? classifyNps(score) : null,
      comment: comment ?? null,
      status: 'RESPONDIDA',
      answeredAt: new Date(),
    })
    .where(eq(surveyResponses.id, id))
    .returning();

  if (survey.type === 'NPS') {
    await db.update(students).set({ npsLast: score }).where(eq(students.id, survey.studentId));
  } else {
    await db.update(students).set({ csatLast: score }).where(eq(students.id, survey.studentId));
  }

  return row;
}

/** Cria automaticamente as pesquisas de NPS em D+30, D+60, D+90 e na conclusão. */
export async function schedulePeriodicNps() {
  const rows = await db.select().from(students).where(eq(students.active, true));
  const now = Date.now();
  const created: string[] = [];

  for (const s of rows) {
    const days = Math.floor((now - s.enrolledAt.getTime()) / 86_400_000);
    const milestones: { trigger: 'D30' | 'D60' | 'D90'; at: number }[] = [
      { trigger: 'D30', at: 30 },
      { trigger: 'D60', at: 60 },
      { trigger: 'D90', at: 90 },
    ];
    for (const m of milestones) {
      if (days < m.at) continue;
      const existing = await db
        .select({ id: surveyResponses.id })
        .from(surveyResponses)
        .where(
          and(
            eq(surveyResponses.studentId, s.id),
            eq(surveyResponses.type, 'NPS'),
            eq(surveyResponses.trigger, m.trigger),
          ),
        )
        .limit(1);
      if (existing.length) continue;
      const row = await createSurvey({ studentId: s.id, type: 'NPS', trigger: m.trigger });
      created.push(row.id);
    }
  }
  return created;
}

export async function listSurveys(filter: { type?: 'NPS' | 'CSAT'; status?: string[]; limit?: number } = {}) {
  const conditions = [];
  if (filter.type) conditions.push(eq(surveyResponses.type, filter.type));
  if (filter.status?.length)
    conditions.push(inArray(surveyResponses.status, filter.status as never));

  return db
    .select({
      survey: surveyResponses,
      student: { id: students.id, name: students.name, code: students.code, email: students.email },
    })
    .from(surveyResponses)
    .innerJoin(students, eq(surveyResponses.studentId, students.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(surveyResponses.createdAt))
    .limit(filter.limit ?? 200);
}
