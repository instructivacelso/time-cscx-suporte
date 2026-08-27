'use client';

import { useState, useTransition } from 'react';
import { Loader2, Star } from 'lucide-react';
import { answerSurveyAction } from '@/app/actions';

export function SurveyForm({
  surveyId,
  type,
  question,
  studentName,
}: {
  surveyId: string;
  type: 'NPS' | 'CSAT';
  question: string;
  studentName: string;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="py-8 text-center">
        <p className="text-3xl">🙏</p>
        <h1 className="mt-3 text-lg font-semibold text-ink-950">Obrigado!</h1>
        <p className="mt-1 text-sm text-ink-500">Sua resposta foi registrada.</p>
      </div>
    );
  }

  const submit = () => {
    if (score === null) return;
    start(async () => {
      const fd = new FormData();
      fd.set('surveyId', surveyId);
      fd.set('score', String(score));
      fd.set('comment', comment);
      await answerSurveyAction(fd);
      setDone(true);
    });
  };

  return (
    <div>
      <p className="text-xs text-ink-500">Olá, {studentName.split(' ')[0]}</p>
      <h1 className="mt-1 text-lg font-semibold leading-snug text-ink-950">{question}</h1>

      {type === 'NPS' ? (
        <>
          <div className="mt-5 grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onClick={() => setScore(i)}
                className={`aspect-square rounded-lg border text-sm font-medium transition ${
                  score === i
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-line bg-surface text-ink-700 hover:border-brand-300 hover:bg-brand-50'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-ink-400">
            <span>Não recomendaria</span>
            <span>Recomendaria com certeza</span>
          </div>
        </>
      ) : (
        <div className="mt-6 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onClick={() => setScore(i)}
              aria-label={`${i} estrela${i > 1 ? 's' : ''}`}
              className="transition hover:scale-110"
            >
              <Star
                className={`h-9 w-9 ${
                  score !== null && i <= score
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-ink-300'
                }`}
              />
            </button>
          ))}
        </div>
      )}

      <label className="label mt-5 block" htmlFor="comment">
        Quer comentar alguma coisa? (opcional)
      </label>
      <textarea
        id="comment"
        rows={3}
        className="input mt-1"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="O que mais pesou na sua nota?"
      />

      <button className="btn-primary mt-4 w-full" disabled={score === null || pending} onClick={submit}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Enviar resposta
      </button>
    </div>
  );
}
