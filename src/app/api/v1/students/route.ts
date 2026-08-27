import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { students } from '@/db/schema';
import { authorizeApi } from '@/lib/api-auth';
import { recordAudit } from '@/lib/audit';
import { listStudents } from '@/server/student-service';
import { ensureOnboardingChecklist } from '@/server/journey-service';
import { runAutomations } from '@/server/automation-service';
import { refreshStudent } from '@/server/routine';

const upsertSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2).optional(),
  origin: z.string().optional(),
  enrolledAt: z.string().datetime().optional(),
  weeklyGoalHours: z.number().optional(),
  monthlyGoalHours: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  const auth = await authorizeApi(request);
  if (!auth.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const url = new URL(request.url);
  const { rows, total } = await listStudents({
    search: url.searchParams.get('q') ?? undefined,
    band: url.searchParams.get('faixa') ? [url.searchParams.get('faixa') as string] : undefined,
    stage: url.searchParams.get('etapa') ? [url.searchParams.get('etapa') as string] : undefined,
    limit: Math.min(500, Number(url.searchParams.get('limit') ?? 100)),
    offset: Number(url.searchParams.get('offset') ?? 0),
  });

  return NextResponse.json({
    total,
    data: rows.map(({ student, owner, openAlerts, course }) => ({
      id: student.id,
      code: student.code,
      name: student.name,
      email: student.email,
      stage: student.stage,
      healthScore: student.healthScore,
      healthBand: student.healthBand,
      churnRisk: student.churnRisk,
      progressPercent: student.progressPercent,
      onboardingPercent: student.onboardingPercent,
      daysWithoutAccess: student.daysWithoutAccess,
      paymentStatus: student.paymentStatus,
      npsLast: student.npsLast,
      csatLast: student.csatLast,
      owner: owner?.name ?? null,
      course,
      openAlerts,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await authorizeApi(request);
  if (!auth.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const parsed = upsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  const [existing] = await db.select().from(students).where(eq(students.email, body.email));

  if (existing) {
    const [updated] = await db
      .update(students)
      .set({
        name: body.name,
        phone: body.phone ?? existing.phone,
        city: body.city ?? existing.city,
        state: body.state ?? existing.state,
        origin: body.origin ?? existing.origin,
        tags: body.tags ?? existing.tags,
        updatedAt: new Date(),
      })
      .where(eq(students.id, existing.id))
      .returning();

    await recordAudit({
      action: 'UPDATE',
      entity: 'student',
      entityId: updated.id,
      summary: `Aluno atualizado via API (${auth.actor})`,
    });
    return NextResponse.json({ id: updated.id, created: false });
  }

  const [created] = await db
    .insert(students)
    .values({
      code: body.code,
      name: body.name,
      email: body.email,
      phone: body.phone ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      origin: body.origin ?? null,
      enrolledAt: body.enrolledAt ? new Date(body.enrolledAt) : new Date(),
      weeklyGoalHours: body.weeklyGoalHours ?? 4,
      monthlyGoalHours: body.monthlyGoalHours ?? 16,
      tags: body.tags ?? [],
    })
    .returning();

  await ensureOnboardingChecklist(created.id);
  await runAutomations('NOVO_ALUNO', { studentId: created.id });
  await refreshStudent(created.id);

  await recordAudit({
    action: 'CREATE',
    entity: 'student',
    entityId: created.id,
    summary: `Aluno criado via API (${auth.actor}) — onboarding disparado`,
  });

  return NextResponse.json({ id: created.id, created: true }, { status: 201 });
}
