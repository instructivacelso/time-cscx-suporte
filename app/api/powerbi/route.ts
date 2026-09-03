import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { powerBiPayload } from '@/server/export-service';

/**
 * Feed JSON para o Power BI (ou qualquer BI que consuma REST).
 *
 * Autenticação: sessão do CSCX **ou** header `x-api-key` igual a POWERBI_API_KEY.
 * No Power BI: Obter dados → Web → informe a URL e o cabeçalho x-api-key.
 */
export async function GET(request: Request) {
  const key = request.headers.get('x-api-key');
  const expected = process.env.POWERBI_API_KEY;

  if (!(expected && key === expected)) {
    const session = await getSession();
    if (!session || !can(session.role, 'relatorio.export')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
  }

  return NextResponse.json(await powerBiPayload());
}
