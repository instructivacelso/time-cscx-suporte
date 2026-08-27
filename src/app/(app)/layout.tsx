import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { AppShell, type NavItem } from '@/components/app-shell';
import { openAlertCount } from '@/server/routine';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'ALUNO') redirect('/portal');

  const alerts = await openAlertCount().catch(() => 0);
  const role = session.role;

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Visão geral',
      items: [
        { href: '/dashboard', label: 'Dashboard executivo', icon: 'dashboard' },
        { href: '/operacional', label: 'Painel operacional', icon: 'gauge' },
      ].filter((i) =>
        i.href === '/dashboard' ? can(role, 'dashboard.executivo') : can(role, 'dashboard.operacional'),
      ) as NavItem[],
    },
    {
      title: 'Alunos',
      items: [
        { href: '/alunos', label: 'Carteira', icon: 'users' },
        { href: '/jornada', label: 'Jornada', icon: 'activity' },
        { href: '/onboarding', label: 'Onboarding', icon: 'rocket' },
        { href: '/health-score', label: 'Health Score', icon: 'gauge' },
        { href: '/alertas', label: 'Alertas', icon: 'bell', badge: alerts },
      ] as NavItem[],
    },
    {
      title: 'Operação',
      items: [
        { href: '/tarefas', label: 'Tarefas', icon: 'checks' },
        { href: '/planos-acao', label: 'Planos de ação', icon: 'clipboard' },
        { href: '/pesquisas', label: 'NPS & CSAT', icon: 'star' },
        { href: '/automacoes', label: 'Automações', icon: 'workflow' },
        { href: '/playbooks', label: 'Playbooks', icon: 'book' },
      ].filter((i) =>
        i.href === '/automacoes' || i.href === '/playbooks' ? can(role, 'automacao.manage') : true,
      ) as NavItem[],
    },
    {
      title: 'Inteligência',
      items: [
        { href: '/assistente', label: 'Assistente CSCX', icon: 'bot' },
        { href: '/relatorios', label: 'Relatórios', icon: 'report' },
      ].filter((i) =>
        i.href === '/relatorios' ? can(role, 'relatorio.export') : can(role, 'assistente.use'),
      ) as NavItem[],
    },
    {
      title: 'Configuração',
      items: (
        [
          { href: '/equipe', label: 'Equipe', icon: 'users' },
          { href: '/integracoes', label: 'Integrações', icon: 'plug' },
          { href: '/configuracoes', label: 'Health Score', icon: 'settings' },
          { href: '/auditoria', label: 'Auditoria', icon: 'scroll' },
        ] as NavItem[]
      ).filter((i) => {
        if (i.href === '/equipe') return can(role, 'equipe.view');
        if (i.href === '/integracoes') return can(role, 'integracao.manage');
        if (i.href === '/configuracoes') return can(role, 'config.healthScore');
        return can(role, 'auditoria.view');
      }),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <AppShell user={session} groups={groups} alerts={alerts}>
      {children}
    </AppShell>
  );
}
