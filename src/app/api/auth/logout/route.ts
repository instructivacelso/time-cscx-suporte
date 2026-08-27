import { NextResponse } from 'next/server';
import { destroySession, getSession } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';

export async function POST(request: Request) {
  const session = await getSession();
  if (session) {
    await recordAudit({
      userId: session.id,
      action: 'LOGOUT',
      entity: 'user',
      entityId: session.id,
      summary: `${session.name} saiu do sistema`,
    });
  }
  await destroySession();
  return NextResponse.redirect(new URL('/login', request.url));
}

export const GET = POST;
