import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  courses,
  enrollments,
  mentorshipAttendances,
  payments,
  students,
  studyActivities,
} from '@/db/schema';
import { authorizeApi } from '@/lib/api-auth';
import { recordAudit } from '@/lib/audit';
import { refreshStudent } from '@/server/routine';
import { runAutomations } from '@/server/automation-service';
import { createSurvey } from '@/server/survey-service';
import { formatDate } from '@/lib/format';

/**
 * Webhook único de eventos do LMS / financeiro.
 *
 * POST /api/v1/events
 * Header: x-api-key: $API_KEY
 *
 * Tipos suportados:
 *  - acesso                  { studentEmail, at? }
 *  - aula_concluida          { studentEmail, minutes, lessons?, quizzes?, score?, at? }
 *  - progresso               { studentEmail, courseSlug, progressPercent, currentModule?, gradeAverage?, activitiesDone?, activitiesTotal? }
 *  - certificado             { studentEmail, courseSlug, issuedAt? }
 *  - mentoria                { studentEmail, title, attended, minutes?, at? }
 *  - pagamento_confirmado    { studentEmail, reference, amount, paidAt? }
 *  - pagamento_pendente      { studentEmail, reference, amount, dueAt }
 */
const schema = z.object({
  type: z.enum([
    'acesso',
    'aula_concluida',
    'progresso',
    'certificado',
    'mentoria',
    'pagamento_confirmado',
    'pagamento_pendente',
  ]),
  studentEmail: z.string().email(),
  payload: z.record(z.any()).default({}),
});

export async function POST(request: Request) {
  const auth = await authorizeApi(request);
  if (!auth.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', issues: parsed.error.issues }, { status: 400 });
  }

  const { type, studentEmail, payload } = parsed.data;
  const [student] = await db.select().from(students).where(eq(students.email, studentEmail));
  if (!student) return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });

  const at = payload.at ? new Date(payload.at) : new Date();

  switch (type) {
    case 'acesso': {
      await db.update(students).set({ lastAccessAt: at, daysWithoutAccess: 0 }).where(eq(students.id, student.id));
      break;
    }

    case 'aula_concluida': {
      await db.insert(studyActivities).values({
        studentId: student.id,
        date: at,
        minutes: Number(payload.minutes ?? 0),
        lessonsDone: Number(payload.lessons ?? 1),
        quizzesDone: Number(payload.quizzes ?? 0),
        score: payload.score !== undefined ? Number(payload.score) : null,
        communityPosts: Number(payload.communityPosts ?? 0),
      });
      await db
        .update(students)
        .set({
          lastAccessAt: at,
          daysWithoutAccess: 0,
          studiedHours: student.studiedHours + Number(payload.minutes ?? 0) / 60,
        })
        .where(eq(students.id, student.id));
      break;
    }

    case 'progresso': {
      const [course] = await db.select().from(courses).where(eq(courses.slug, String(payload.courseSlug)));
      if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

      const progress = Number(payload.progressPercent ?? 0);
      await db
        .update(enrollments)
        .set({
          progressPercent: progress,
          currentModule: payload.currentModule ? String(payload.currentModule) : undefined,
          gradeAverage: payload.gradeAverage !== undefined ? Number(payload.gradeAverage) : undefined,
          activitiesDone: payload.activitiesDone !== undefined ? Number(payload.activitiesDone) : undefined,
          activitiesTotal: payload.activitiesTotal !== undefined ? Number(payload.activitiesTotal) : undefined,
        })
        .where(and(eq(enrollments.studentId, student.id), eq(enrollments.courseId, course.id)));

      if (progress >= 80 && progress < 100) {
        await runAutomations('ALUNO_CONCLUINDO', {
          studentId: student.id,
          vars: { curso: course.name, progresso: Math.round(progress) },
        });
      }
      break;
    }

    case 'certificado': {
      const [course] = await db.select().from(courses).where(eq(courses.slug, String(payload.courseSlug)));
      if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });
      const issued = payload.issuedAt ? new Date(payload.issuedAt) : new Date();

      await db
        .update(enrollments)
        .set({
          status: 'CONCLUIDA',
          progressPercent: 100,
          finishedAt: issued,
          certificateIssuedAt: issued,
        })
        .where(and(eq(enrollments.studentId, student.id), eq(enrollments.courseId, course.id)));

      await runAutomations('ALUNO_CERTIFICADO', {
        studentId: student.id,
        vars: { curso: course.name },
      });
      await createSurvey({ studentId: student.id, type: 'NPS', trigger: 'CONCLUSAO' });
      break;
    }

    case 'mentoria': {
      await db.insert(mentorshipAttendances).values({
        studentId: student.id,
        title: String(payload.title ?? 'Mentoria'),
        date: at,
        attended: Boolean(payload.attended),
        minutes: Number(payload.minutes ?? 0),
      });
      if (payload.attended) {
        await createSurvey({ studentId: student.id, type: 'CSAT', trigger: 'MENTORIA' });
      }
      break;
    }

    case 'pagamento_confirmado': {
      const paidAt = payload.paidAt ? new Date(payload.paidAt) : new Date();
      await db.insert(payments).values({
        studentId: student.id,
        reference: String(payload.reference ?? 'Parcela'),
        amount: String(payload.amount ?? 0),
        dueAt: payload.dueAt ? new Date(payload.dueAt) : paidAt,
        paidAt,
        status: 'EM_DIA',
        gateway: String(payload.gateway ?? 'api'),
      });
      await runAutomations('PAGAMENTO_CONFIRMADO', {
        studentId: student.id,
        vars: { valor: `R$ ${payload.amount}`, referencia: String(payload.reference ?? '') },
      });
      break;
    }

    case 'pagamento_pendente': {
      const dueAt = new Date(payload.dueAt);
      await db.insert(payments).values({
        studentId: student.id,
        reference: String(payload.reference ?? 'Parcela'),
        amount: String(payload.amount ?? 0),
        dueAt,
        status: 'PENDENTE',
        gateway: String(payload.gateway ?? 'api'),
      });
      await runAutomations('PAGAMENTO_PENDENTE', {
        studentId: student.id,
        vars: {
          valor: `R$ ${payload.amount}`,
          referencia: String(payload.reference ?? ''),
          vencimento: formatDate(dueAt),
        },
      });
      break;
    }
  }

  const recalc = await refreshStudent(student.id);

  await recordAudit({
    action: 'EVENT',
    entity: 'student',
    entityId: student.id,
    summary: `Evento "${type}" recebido via API (${auth.actor})`,
    metadata: payload,
  });

  return NextResponse.json({
    ok: true,
    studentId: student.id,
    healthScore: recalc?.score ?? null,
    healthBand: recalc?.band ?? null,
    churnRisk: recalc?.churnRisk ?? null,
  });
}
