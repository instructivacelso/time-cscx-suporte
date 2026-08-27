import { getSession } from './auth';
import { isStaff } from './rbac';

/**
 * Autenticação da API REST de integração.
 * Aceita `x-api-key` (variável API_KEY) ou uma sessão de usuário interno.
 */
export async function authorizeApi(request: Request) {
  const expected = process.env.API_KEY;
  const key = request.headers.get('x-api-key');
  if (expected && key === expected) return { ok: true as const, actor: 'api-key' };

  const session = await getSession();
  if (session && isStaff(session.role)) return { ok: true as const, actor: session.id };

  return { ok: false as const, actor: null };
}
