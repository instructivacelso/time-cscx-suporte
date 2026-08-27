import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { Avatar } from '@/components/ui';
import { LogoMark } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/portal', label: 'Meu painel' },
  { href: '/portal/trilha', label: 'Minha trilha' },
  { href: '/portal/mensagens', label: 'Mensagens' },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ALUNO' && session.role !== 'ADMIN') redirect('/dashboard');

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <LogoMark size={36} badge="dark" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-ink-950">Área do aluno</div>
            <div className="text-[11px] text-ink-500">Escola Instructiva</div>
          </div>

          <nav className="ml-6 hidden gap-1 sm:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-1.5 text-sm text-ink-600 transition hover:bg-surface-2 hover:text-ink-900"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle className="h-9 w-9" />
            <Avatar name={session.name} color={session.avatarColor} size={30} />
            <span className="hidden text-sm text-ink-700 sm:block">{session.name.split(' ')[0]}</span>
            <form action="/api/auth/logout" method="post">
              <button className="grid h-9 w-9 place-items-center rounded-xl border border-line text-ink-500 transition hover:bg-surface-2 hover:text-ink-900">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 sm:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-ink-600 transition hover:bg-surface-2"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
