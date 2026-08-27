'use server';

import { redirect } from 'next/navigation';
import { authenticate, createSession, destroySession } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { getStudentByUserId } from '@/server/student-service';

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Informe e-mail e senha.' };
  }

  let user: Awaited<ReturnType<typeof authenticate>>;
  let studentId: string | null = null;

  try {
    user = await authenticate(email, password);
    if (user?.role === 'ALUNO') {
      studentId = (await getStudentByUserId(user.id))?.id ?? null;
    }
  } catch (err) {
    // Falha de banco (fora do ar, schema não aplicado, credencial errada…).
    console.error('[login] falha ao consultar o banco:', err);
    return {
      error:
        'Não consegui falar com o banco de dados agora. Tente de novo em instantes — se persistir, abra /api/health para ver o diagnóstico.',
    };
  }

  if (!user) {
    return { error: 'E-mail ou senha inválidos.' };
  }

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarColor: user.avatarColor,
    studentId,
  });

  await recordAudit({
    userId: user.id,
    action: 'LOGIN',
    entity: 'user',
    entityId: user.id,
    summary: `${user.name} entrou no sistema`,
  });

  redirect(user.role === 'ALUNO' ? '/portal' : '/dashboard');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}
