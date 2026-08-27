import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { students, surveyResponses } from '@/db/schema';
import { CSAT_QUESTIONS, NPS_QUESTION } from '@/server/survey-service';
import { SurveyForm } from './survey-form';
import { LogoMark } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export const dynamic = 'force-dynamic';

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [row] = await db
    .select({ survey: surveyResponses, student: { name: students.name } })
    .from(surveyResponses)
    .innerJoin(students, eq(surveyResponses.studentId, students.id))
    .where(eq(surveyResponses.id, id));

  if (!row) notFound();

  const question =
    row.survey.type === 'NPS'
      ? NPS_QUESTION
      : (CSAT_QUESTIONS[row.survey.trigger] ?? CSAT_QUESTIONS.MANUAL);

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-canvas p-4">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          backgroundImage:
            'radial-gradient(60% 100% at 50% 0%, rgb(var(--brand-500) / .16) 0%, transparent 70%)',
        }}
      />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-lg animate-scale-in">
        <div className="mb-5 flex flex-col items-center text-center">
          <LogoMark size={56} badge="dark" className="mb-3" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Escola Instructiva
          </p>
        </div>

        <div className="card card-pad shadow-pop sm:p-7">
          {row.survey.status === 'RESPONDIDA' ? (
            <div className="py-8 text-center">
              <p className="text-4xl">🙏</p>
              <h1 className="mt-3 font-display text-lg font-semibold text-ink-950">
                Obrigado pela sua resposta!
              </h1>
              <p className="mt-1 text-sm text-ink-500">
                Sua nota foi <strong className="text-ink-800">{row.survey.score}</strong>. Já
                registramos e a equipe vai analisar.
              </p>
            </div>
          ) : (
            <SurveyForm
              surveyId={row.survey.id}
              type={row.survey.type}
              question={question}
              studentName={row.student.name}
            />
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-ink-400">
          CSCX · Customer Success &amp; Customer Experience
        </p>
      </div>
    </main>
  );
}
