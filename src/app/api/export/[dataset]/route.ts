import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { recordAudit } from '@/lib/audit';
import { buildDataset, toCsv, toXlsx, type Dataset } from '@/server/export-service';

const VALID: Dataset[] = ['alunos', 'alertas', 'pesquisas', 'indicadores', 'cursos'];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dataset: string }> },
) {
  const session = await getSession();
  if (!session || !can(session.role, 'relatorio.export')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const { dataset } = await params;
  if (!VALID.includes(dataset as Dataset)) {
    return NextResponse.json({ error: 'Conjunto de dados inválido' }, { status: 404 });
  }

  const format = new URL(request.url).searchParams.get('format') ?? 'csv';
  const sheet = await buildDataset(dataset as Dataset);
  const stamp = new Date().toISOString().slice(0, 10);

  await recordAudit({
    userId: session.id,
    action: 'EXPORT',
    entity: 'report',
    entityId: dataset,
    summary: `Exportou ${dataset} em ${format.toUpperCase()}`,
  });

  if (format === 'xlsx') {
    const buffer = await toXlsx([sheet]);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="cscx-${dataset}-${stamp}.xlsx"`,
      },
    });
  }

  return new NextResponse(toCsv(sheet), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cscx-${dataset}-${stamp}.csv"`,
    },
  });
}
