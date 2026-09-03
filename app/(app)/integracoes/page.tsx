import { Badge, Card, PageHeader, SectionTitle } from '@/components/ui';
import { db } from '@/db';
import { integrations } from '@/db/schema';
import { INTEGRATION_CATALOG } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { updateIntegrationAction } from '@/app/actions';
import { ultimosWebhooks } from '@/server/cademi';
import { WebhookLog } from '@/components/webhook-log';

export const dynamic = 'force-dynamic';

/** Verifica no servidor quais variáveis de ambiente já estão preenchidas. */
function envStatus(keys: string[]) {
  return keys.map((k) => ({ key: k, filled: Boolean(process.env[k]) }));
}

export default async function IntegrationsPage() {
  const [rows, webhooks] = await Promise.all([
    db.select().from(integrations).orderBy(integrations.name),
    ultimosWebhooks(10).catch(() => []),
  ]);
  const byKind = new Map(rows.map((r) => [r.kind as string, r]));

  const appUrl = process.env.APP_URL ?? 'https://SEU-APP.up.railway.app';
  const segredoDefinido = Boolean(process.env.CADEMI_WEBHOOK_SECRET ?? process.env.API_KEY);

  const grouped = INTEGRATION_CATALOG.reduce<Record<string, typeof INTEGRATION_CATALOG>>(
    (acc, i) => {
      (acc[i.category] ??= []).push(i);
      return acc;
    },
    {},
  );

  return (
    <>
      <PageHeader
        title="Integrações"
        subtitle="Conexões do CSCX com o LMS, comunicação, financeiro, marketing e BI."
      />

      <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
        As chaves são lidas de <strong>variáveis de ambiente</strong> — no Railway, aba{' '}
        <em>Variables</em> do serviço. Nada de credencial gravada no banco. Enquanto uma chave não
        existe, o módulo correspondente opera em modo simulado.
      </div>

      <div className="space-y-5">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h2 className="mb-2 text-sm font-semibold text-ink-900">{category}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((i) => {
                const row = byKind.get(i.kind);
                const env = envStatus(i.envKeys);
                const ready = env.every((e) => e.filled);
                return (
                  <Card key={i.kind}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink-900">{i.name}</h3>
                      <Badge tone={ready ? 'green' : 'amber'}>
                        {ready ? 'chaves presentes' : 'aguardando chaves'}
                      </Badge>
                      {row && <Badge tone="ink">{row.status.replaceAll('_', ' ').toLowerCase()}</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-ink-500">{i.description}</p>

                    <ul className="mt-2 space-y-1">
                      {env.map((e) => (
                        <li key={e.key} className="flex items-center gap-2 text-xs">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${e.filled ? 'bg-emerald-500' : 'bg-ink-300'}`}
                          />
                          <code className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-ink-700">
                            {e.key}
                          </code>
                          <span className="text-ink-400">{e.filled ? 'definida' : 'não definida'}</span>
                        </li>
                      ))}
                    </ul>

                    {row && (
                      <form action={updateIntegrationAction} className="mt-3 flex flex-wrap gap-2">
                        <input type="hidden" name="integrationId" value={row.id} />
                        <select name="status" defaultValue={row.status} className="input max-w-[190px] py-1 text-xs">
                          {['NAO_CONFIGURADA', 'CONFIGURADA', 'CONECTADA', 'ERRO'].map((s) => (
                            <option key={s} value={s}>
                              {s.replaceAll('_', ' ').toLowerCase()}
                            </option>
                          ))}
                        </select>
                        <input
                          name="notes"
                          defaultValue={row.notes ?? ''}
                          placeholder="Observações"
                          className="input flex-1 py-1 text-xs"
                        />
                        <button className="btn-ghost px-2.5 py-1 text-xs" type="submit">
                          Salvar
                        </button>
                      </form>
                    )}

                    {row?.lastSyncAt && (
                      <p className="mt-1.5 text-[11px] text-ink-400">
                        última sincronização: {formatDateTime(row.lastSyncAt)}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Card className="mt-5">
        <SectionTitle
          title="Cademí — entrada automática de alunos"
          description="Cada aluno liberado na Cademí (venda pela Green, Hotmart, TMB ou liberação manual) entra aqui sozinho e começa o onboarding."
        />

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={segredoDefinido ? 'green' : 'amber'}>
            {segredoDefinido ? 'chave definida' : 'aguardando CADEMI_WEBHOOK_SECRET'}
          </Badge>
          <Badge tone="ink">{webhooks.length} eventos recebidos (últimos 10)</Badge>
        </div>

        <p className="mt-3 text-xs text-ink-600">
          Endereço para cadastrar em <strong>Cademí → engrenagem → Webhook → Novo webhook</strong>:
        </p>
        <code className="mt-1 block overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 text-[11px] text-ink-800">
          {appUrl}/api/webhooks/cademi?chave=SUA_CHAVE
        </code>
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
          Troque <code className="rounded bg-surface-3 px-1">SUA_CHAVE</code> pelo valor de{' '}
          <code className="rounded bg-surface-3 px-1">CADEMI_WEBHOOK_SECRET</code>. Cadastre a mesma
          URL nos eventos <em>Usuário Criado</em>, <em>Entrega Adicionada</em>,{' '}
          <em>Usuário Progresso</em>, <em>Certificado Emitido</em> e <em>Prova Aprovado</em>.
        </p>

        <div className="mt-4 border-t border-line pt-3">
          <p className="label mb-1">Últimos webhooks recebidos</p>
          <WebhookLog
            rows={webhooks.map((w) => ({
              id: w.id,
              source: w.source,
              eventType: w.eventType,
              email: w.email,
              status: w.status,
              message: w.message,
              payload: w.payload,
              recebidoEm: formatDateTime(w.receivedAt),
            }))}
          />
        </div>
      </Card>

      <Card className="mt-5">
        <SectionTitle title="Outras variáveis usadas pelo sistema" />
        <ul className="grid gap-2 text-xs text-ink-600 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['DATABASE_URL', 'Conexão PostgreSQL (o Railway injeta automaticamente)'],
            ['AUTH_SECRET', 'Chave de assinatura das sessões (obrigatória)'],
            ['APP_URL', 'URL pública, usada nos links das pesquisas'],
            ['OPENAI_API_KEY', 'Assistente CSCX'],
            ['OPENAI_MODEL', 'Modelo usado (padrão gpt-4o-mini)'],
            ['CRON_SECRET', 'Protege o endpoint da rotina diária'],
            ['CADEMI_WEBHOOK_SECRET', 'Chave do webhook da Cademí'],
            ['POWERBI_API_KEY', 'Autentica o feed JSON do Power BI'],
            ['LMS_STUDENT_URL', 'Link do ambiente do aluno nas mensagens'],
            ['WELCOME_VIDEO_URL', 'Vídeo institucional do onboarding'],
            ['TUTORIAL_URL', 'Tutorial da plataforma'],
            ['REFERRAL_URL', 'Link do programa de indicação'],
            ['SEED_PASSWORD', 'Senha usada ao popular a base de demonstração'],
          ].map(([k, d]) => (
            <li key={k} className="flex flex-col gap-0.5 rounded-lg border border-line p-2">
              <code className="text-[11px] font-medium text-ink-800">{k}</code>
              <span className="text-ink-500">{d}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
