import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { Badge, Card, PageHeader, SectionTitle, StatusBadge } from '@/components/ui';
import { db } from '@/db';
import { students } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { getStudent360 } from '@/server/student-service';
import { CHANNEL_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const session = await getSession();
  const studentId =
    session?.studentId ??
    (await db.select({ id: students.id }).from(students).orderBy(desc(students.createdAt)).limit(1))[0]
      ?.id;

  const s = studentId ? await getStudent360(studentId) : null;
  if (!s) return <Card><p className="py-10 text-center text-sm text-ink-500">Sem dados.</p></Card>;

  return (
    <>
      <PageHeader title="Mensagens e pesquisas" subtitle="Tudo que a escola trocou com você." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Histórico de mensagens" />
          <ul className="divide-y divide-line">
            {s.interactions.map((i) => (
              <li key={i.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={i.direction === 'ENTRADA' ? 'violet' : 'brand'}>
                    {CHANNEL_LABELS[i.channel] ?? i.channel}
                  </Badge>
                  <span className="text-sm font-medium text-ink-900">{i.subject}</span>
                  <span className="ml-auto text-xs text-ink-400">{formatDateTime(i.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{i.content}</p>
              </li>
            ))}
            {s.interactions.length === 0 && (
              <li className="py-8 text-center text-sm text-ink-500">Nenhuma mensagem ainda.</li>
            )}
          </ul>
        </Card>

        <Card>
          <SectionTitle title="Pesquisas" description="Sua opinião ajuda a escola a melhorar." />
          <ul className="space-y-2">
            {s.surveys.map((v) => (
              <li key={v.id} className="rounded-lg border border-line p-3">
                <div className="flex items-center gap-2">
                  <Badge tone={v.type === 'NPS' ? 'brand' : 'violet'}>{v.type}</Badge>
                  <StatusBadge status={v.status} />
                  <span className="ml-auto text-[11px] text-ink-400">
                    {formatDateTime(v.answeredAt ?? v.createdAt)}
                  </span>
                </div>
                {v.status === 'RESPONDIDA' ? (
                  <p className="mt-1.5 text-xs text-ink-600">
                    Sua nota: <strong>{v.score}</strong>
                    {v.comment ? ` — “${v.comment}”` : ''}
                  </p>
                ) : (
                  <Link href={`/pesquisa/${v.id}`} className="btn-primary mt-2 w-full px-3 py-1.5 text-xs">
                    Responder agora
                  </Link>
                )}
              </li>
            ))}
            {s.surveys.length === 0 && (
              <li className="py-6 text-center text-sm text-ink-500">Nenhuma pesquisa enviada.</li>
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}
