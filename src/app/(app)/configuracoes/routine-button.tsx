'use client';

import { useState, useTransition } from 'react';
import { Loader2, PlayCircle } from 'lucide-react';
import { runRoutineAction } from '@/app/actions';

export function RoutineButton() {
  const [pending, start] = useTransition();
  const [report, setReport] = useState<Awaited<ReturnType<typeof runRoutineAction>> | null>(null);

  return (
    <div>
      <button
        className="btn-primary w-full"
        disabled={pending}
        onClick={() => start(async () => setReport(await runRoutineAction()))}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
        {pending ? 'Processando…' : 'Rodar rotina agora'}
      </button>

      {report && (
        <ul className="mt-3 space-y-1 rounded-lg bg-surface-2 p-3 text-xs text-ink-600">
          <li>Alunos processados: <strong>{report.processed}</strong></li>
          <li>Alertas abertos: <strong>{report.alertsCreated}</strong></li>
          <li>Alertas resolvidos: <strong>{report.alertsResolved}</strong></li>
          <li>Planos criados: <strong>{report.plansCreated}</strong></li>
          <li>Automações disparadas: <strong>{report.automationsFired}</strong></li>
          <li>Pesquisas agendadas: <strong>{report.surveysScheduled}</strong></li>
          <li>Duração: <strong>{(report.durationMs / 1000).toFixed(1)}s</strong></li>
        </ul>
      )}
    </div>
  );
}
