import { desc, eq, asc } from 'drizzle-orm';
import { Award, CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import { Badge, Card, PageHeader, Progress, SectionTitle } from '@/components/ui';
import { db } from '@/db';
import { modules, students, tracks } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { getStudent360 } from '@/server/student-service';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TrackPage() {
  const session = await getSession();
  const studentId =
    session?.studentId ??
    (await db.select({ id: students.id }).from(students).orderBy(desc(students.createdAt)).limit(1))[0]
      ?.id;

  const s = studentId ? await getStudent360(studentId) : null;
  if (!s) return <Card><p className="py-10 text-center text-sm text-ink-500">Sem dados.</p></Card>;

  const trilhas = await Promise.all(
    s.enrollments.map(async ({ enrollment, course }) => {
      if (!course) return null;
      const ts = await db
        .select()
        .from(tracks)
        .where(eq(tracks.courseId, course.id))
        .orderBy(asc(tracks.order));
      const withModules = await Promise.all(
        ts.map(async (t) => ({
          track: t,
          modules: await db
            .select()
            .from(modules)
            .where(eq(modules.trackId, t.id))
            .orderBy(asc(modules.order)),
        })),
      );
      return { enrollment, course, tracks: withModules };
    }),
  );

  return (
    <>
      <PageHeader
        title="Minha trilha"
        subtitle="Todos os módulos do seu curso, na ordem recomendada de estudo."
      />

      <div className="space-y-4">
        {trilhas.filter(Boolean).map((t) => {
          const item = t!;
          const allModules = item.tracks.flatMap((x) => x.modules);
          const doneCount = Math.round((item.enrollment.progressPercent / 100) * allModules.length);
          let counter = 0;

          return (
            <Card key={item.enrollment.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink-900">{item.course.name}</h2>
                {item.enrollment.certificateIssuedAt ? (
                  <Badge tone="green">
                    <Award className="h-3 w-3" /> certificado em{' '}
                    {formatDate(item.enrollment.certificateIssuedAt)}
                  </Badge>
                ) : (
                  <Badge tone="brand">{Math.round(item.enrollment.progressPercent)}% concluído</Badge>
                )}
              </div>
              <Progress className="mb-4" value={item.enrollment.progressPercent} showLabel />

              <div className="space-y-4">
                {item.tracks.map(({ track, modules: mods }) => (
                  <div key={track.id}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                      {track.name}
                    </p>
                    <ul className="space-y-1.5">
                      {mods.map((m) => {
                        const idx = counter++;
                        const done = idx < doneCount;
                        const current = idx === doneCount;
                        return (
                          <li
                            key={m.id}
                            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                              current
                                ? 'border-brand-200 bg-brand-50'
                                : 'border-line bg-surface'
                            }`}
                          >
                            {done ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            ) : current ? (
                              <PlayCircle className="h-4 w-4 shrink-0 text-brand-600" />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-ink-300" />
                            )}
                            <span
                              className={
                                done ? 'text-ink-500' : current ? 'font-medium text-brand-800' : 'text-ink-700'
                              }
                            >
                              {m.name}
                            </span>
                            <span className="ml-auto text-[11px] text-ink-400">{m.lessons} aulas</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
