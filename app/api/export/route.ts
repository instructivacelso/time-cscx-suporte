import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { recordAudit } from '@/lib/audit';
import { buildDataset, toXlsx } from '@/server/export-service';

/** Pacote completo em uma única planilha, com uma aba por conjunto de dados. */
export async function GET() {
  const session = await getSession();
  if (!session || !can(session.role, 'relatorio.export')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const sheets = await Promise.all(
    (['indicadores', 'alunos', 'cursos', 'alertas', 'pesquisas'] as const).map(buildDataset),
  );
  const buffer = await toXlsx(sheets);
  const stamp = new Date().toISOString().slice(0, 10);

  await recordAudit({
    userId: session.id,
    action: 'EXPORT',
    entity: 'report',
    summary: 'Exportou o pacote completo em XLSX',
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="cscx-completo-${stamp}.xlsx"`,
    },
  });
}
