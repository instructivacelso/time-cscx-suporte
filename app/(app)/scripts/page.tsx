import { Card, PageHeader, SectionTitle } from '@/components/ui';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { ensureScriptsPadrao, listarScripts } from '@/server/script-service';
import { ScriptEditor } from './script-editor';

export const dynamic = 'force-dynamic';

export default async function ScriptsPage() {
  // Na primeira visita, cria os modelos padrão para ninguém começar do zero.
  await ensureScriptsPadrao().catch(() => null);

  const [scripts, session] = await Promise.all([listarScripts(), getSession()]);

  return (
    <>
      <PageHeader
        title="Scripts de mensagem"
        subtitle="Os textos que a equipe usa no atendimento. Escritos uma vez, usados por todo mundo do mesmo jeito."
      />

      <Card className="mb-4">
        <SectionTitle title="Como funciona" />
        <ul className="space-y-1.5 text-sm text-ink-600">
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
            Os scripts de <strong>WhatsApp</strong> aparecem no botão “Chamar no WhatsApp” da ficha
            do aluno, já com o nome e o curso preenchidos.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
            O que estiver entre chaves — <code className="rounded bg-surface-3 px-1 text-xs">{'{{nome}}'}</code>,{' '}
            <code className="rounded bg-surface-3 px-1 text-xs">{'{{curso}}'}</code> — é trocado pelo
            dado real de cada aluno.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
            Marque como <strong>inativo</strong> em vez de excluir quando quiser apenas tirar um
            script de circulação por um tempo.
          </li>
        </ul>
      </Card>

      <ScriptEditor
        scripts={scripts.map((s) => ({
          id: s.id,
          title: s.title,
          channel: s.channel,
          situation: s.situation,
          subject: s.subject,
          content: s.content,
          order: s.order,
          active: s.active,
        }))}
        podeEditar={can(session?.role, 'interacao.create')}
      />
    </>
  );
}
