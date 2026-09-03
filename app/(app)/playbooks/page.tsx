import { Badge, Card, PageHeader, SectionTitle } from '@/components/ui';
import { db } from '@/db';
import { playbooks } from '@/db/schema';
import { CHANNEL_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Step {
  order: number;
  title: string;
  channel: string;
  offsetDays: number;
}

export default async function PlaybooksPage() {
  const rows = await db.select().from(playbooks).orderBy(playbooks.name);

  return (
    <>
      <PageHeader
        title="Playbooks"
        subtitle="Sequências padronizadas de atendimento. Servem de guia para a equipe e de base para as automações."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((p) => {
          const steps = (p.steps as Step[]) ?? [];
          return (
            <Card key={p.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-ink-900">{p.name}</h2>
                <Badge tone="brand">{p.trigger.replaceAll('_', ' ').toLowerCase()}</Badge>
                <Badge tone={p.active ? 'green' : 'ink'}>{p.active ? 'ativo' : 'inativo'}</Badge>
              </div>
              <p className="mb-3 text-xs text-ink-500">{p.description}</p>

              <ol className="relative ml-3 border-l border-line">
                {steps
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((s) => (
                    <li key={s.order} className="mb-3 ml-4">
                      <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-surface" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-ink-800">{s.title}</span>
                        <Badge tone="ink">{CHANNEL_LABELS[s.channel] ?? s.channel}</Badge>
                        <span className="text-[11px] text-ink-400">D+{s.offsetDays}</span>
                      </div>
                    </li>
                  ))}
              </ol>

              <p className="mt-2 border-t border-line pt-2 text-[11px] text-ink-400">
                criado em {formatDate(p.createdAt)}
              </p>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <Card>
            <p className="py-10 text-center text-sm text-ink-500">Nenhum playbook cadastrado.</p>
          </Card>
        )}
      </div>
    </>
  );
}
