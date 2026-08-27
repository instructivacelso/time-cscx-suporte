import { NextResponse } from 'next/server';
import { runDailyRoutine } from '@/server/routine';
import { recordAudit } from '@/lib/audit';

export const maxDuration = 300;

/**
 * Rotina diária do CSCX.
 * Agende com Railway Cron (ou similar) enviando `x-cron-key: $CRON_SECRET`.
 */
async function handler(request: Request) {
  const secret = process.env.CRON_SECRET;
  const key = request.headers.get('x-cron-key') ?? new URL(request.url).searchParams.get('key');

  if (secret && key !== secret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const report = await runDailyRoutine();
  await recordAudit({
    action: 'RUN',
    entity: 'routine',
    summary: `Rotina automática: ${report.processed} alunos processados`,
    metadata: report,
  });

  return NextResponse.json(report);
}

export const POST = handler;
export const GET = handler;
