import { asc, eq } from 'drizzle-orm';
import { PageHeader } from '@/components/ui';
import { db } from '@/db';
import { students } from '@/db/schema';
import { aiConfigured } from '@/server/ai-service';
import { AssistantChat } from './assistant-chat';

export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  const rows = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(eq(students.active, true))
    .orderBy(asc(students.name))
    .limit(500);

  return (
    <>
      <PageHeader
        title="Assistente CSCX"
        subtitle="Resume histórico, identifica risco, sugere plano de ação, escreve mensagens e analisa indicadores."
      />
      <AssistantChat students={rows} configured={aiConfigured()} />
    </>
  );
}
