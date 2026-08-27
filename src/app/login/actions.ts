'use server';

import { redirect } from 'next/navigation';
import { authenticate, createSession, destroySession } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { getStudentByUserId } from '@/server/student-service';

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Informe e-mail e senha.' };
  }

  const user = await authenticate(email, password);
  if (!user) {
    return { error: 'E-mail ou senha inválidos.' };
  }

  const student = user.role === 'ALUNO' ? await getStudentByUserId(user.id) : null;

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarColor: user.avatarColor,
    studentId: student?.id ?? null,
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
