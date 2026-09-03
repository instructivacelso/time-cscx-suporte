import { Badge, Card, KpiCard, PageHeader, SectionTitle, StatusBadge } from '@/components/ui';
import { listAutomations, recentRuns } from '@/server/automation-service';
import { toggleAutomationAction, updateAutomationAction } from '@/app/actions';
import { AUTOMATION_TRIGGER_LABELS, CHANNEL_LABELS } from '@/lib/constants';
import { formatDateTime, num } from '@/lib/format';
import { whatsappConfigured, smtpConfigured } from '@/server/messaging';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AutomationsPage() {
  const [rules, runs] = await Promise.all([listAutomations(), recentRuns(50)]);

  const ativas = rules.filter((r) => r.active).length;
  const enviados = runs.filter((r) => r.run.status === 'ENVIADO').length;
  const simulados = runs.filter((r) => r.run.status === 'SIMULADO').length;

  const wa = whatsappConfigured();
  const smtp = smtpConfigured();

  return (
    <>
      <PageHeader
        title="Automações"
        subtitle="Réguas disparadas por evento. As mensagens usam variáveis do aluno entre chaves duplas."
      />

      {(!wa || !smtp) && (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong>Modo simulado ativo.</strong>{' '}
          {!wa && 'WhatsApp Business API não configurada. '}
          {!smtp && 'SMTP não configurado. '}
          As execuções ficam registradas no histórico sem sair da plataforma — preencha as chaves em{' '}
          <Link href="/integracoes" className="underline">
            Integrações
          </Link>{' '}
          para ativar os envios reais.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Automações" value={num(rules.length)} />
        <KpiCard label="Ativas" value={num(ativas)} accent="green" />
        <KpiCard label="Enviadas (últimas 50)" value={num(enviados)} accent="brand" />
        <KpiCard label="Simuladas" value={num(simulados)} accent="amber" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{AUTOMATION_TRIGGER_LABELS[rule.trigger]}</Badge>
                <Badge tone="ink">{CHANNEL_LABELS[rule.channel] ?? rule.channel}</Badge>
                {rule.delayHours > 0 && <Badge tone="violet">+{rule.delayHours}h</Badge>}
                <span className="ml-auto">
                  <form action={toggleAutomationAction}>
                    <input type="hidden" name="automationId" value={rule.id} />
                    <input type="hidden" name="active" value={String(!rule.active)} />
                    <button
                      className={`chip border transition ${
                        rule.active
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'border-line bg-surface text-ink-500'
                      }`}
                    >
                      {rule.active ? 'ativa' : 'inativa'}
                    </button>
                  </form>
                </span>
              </div>

              <details className="mt-2 group">
                <summary className="cursor-pointer list-none">
                  <span className="text-sm font-semibold text-ink-900">{rule.name}</span>
                  <p className="text-xs text-ink-500">{rule.description}</p>
                </summary>

                <form action={updateAutomationAction} className="mt-3 space-y-2 border-t border-line pt-3">
                  <input type="hidden" name="automationId" value={rule.id} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="label">Nome</label>
                      <input name="name" defaultValue={rule.name} className="input mt-1" />
                    </div>
                    <div>
                      <label className="label">Canal</label>
                      <select name="channel" defaultValue={rule.channel} className="input mt-1">
                        {['WHATSAPP', 'EMAIL', 'PLATAFORMA', 'TAREFA_INTERNA', 'WEBHOOK'].map((c) => (
                          <option key={c} value={c}>
                            {CHANNEL_LABELS[c] ?? c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Descrição</label>
                    <input name="description" defaultValue={rule.description} className="input mt-1" />
                  </div>
                  <div>
                    <label className="label">Mensagem</label>
                    <textarea name="template" rows={6} defaultValue={rule.template} className="input mt-1" />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="w-32">
                      <label className="label">Atraso (horas)</label>
                      <input
                        name="delayHours"
                        type="number"
                        min={0}
                        defaultValue={rule.delayHours}
                        className="input mt-1"
                      />
                    </div>
                    <button className="btn-primary" type="submit">
                      Salvar
                    </button>
                  </div>
                </form>
              </details>

              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-sans text-xs text-ink-600">
                {rule.template}
              </pre>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card>
            <SectionTitle title="Variáveis disponíveis" />
            <ul className="space-y-1 text-xs text-ink-600">
              {[
                ['{{nome}}', 'nome completo do aluno'],
                ['{{primeiroNome}}', 'primeiro nome'],
                ['{{curso}}', 'curso principal'],
                ['{{progresso}}', 'percentual concluído'],
                ['{{diasSemAcesso}}', 'dias desde o último acesso'],
                ['{{healthScore}}', 'nota do Health Score'],
                ['{{faixa}}', 'faixa do Health Score'],
                ['{{riscoEvasao}}', 'probabilidade de evasão'],
                ['{{nps}}', 'última nota de NPS'],
                ['{{valor}}', 'valor da parcela'],
                ['{{referencia}}', 'referência da cobrança'],
                ['{{vencimento}}', 'data de vencimento'],
                ['{{linkPesquisa}}', 'link da pesquisa'],
                ['{{linkPlataforma}}', 'link do ambiente do aluno'],
                ['{{mentor}}', 'mentor responsável'],
                ['{{analista}}', 'analista de CS'],
              ].map(([v, d]) => (
                <li key={v} className="flex gap-2">
                  <code className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-ink-800">{v}</code>
                  <span className="text-ink-500">{d}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionTitle title="Últimas execuções" />
            <ul className="divide-y divide-line">
              {runs.slice(0, 20).map(({ run, automation, student }) => (
                <li key={run.id} className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate text-xs text-ink-800">{automation.name}</span>
                    <StatusBadge status={run.status} />
                  </div>
                  <p className="text-[11px] text-ink-400">
                    {student.name} · {formatDateTime(run.createdAt)}
                  </p>
                </li>
              ))}
              {runs.length === 0 && <li className="py-4 text-sm text-ink-500">Sem execuções.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
