'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Bell,
  BookOpen,
  Bot,
  ClipboardList,
  FileBarChart,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Plug,
  Rocket,
  ScrollText,
  Search,
  Settings2,
  Star,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import { cn } from '@/lib/format';
import { Avatar } from './ui';
import { LogoMark } from './logo';
import { ThemeToggle } from './theme-toggle';
import { ROLE_LABELS } from '@/lib/constants';
import type { Role } from '@/db/schema';

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
}

const ICONS = {
  dashboard: LayoutDashboard,
  users: Users,
  gauge: Gauge,
  bell: Bell,
  rocket: Rocket,
  activity: Activity,
  star: Star,
  clipboard: ClipboardList,
  workflow: Workflow,
  report: FileBarChart,
  bot: Bot,
  plug: Plug,
  scroll: ScrollText,
  settings: Settings2,
  book: BookOpen,
  checks: ListChecks,
};

export function AppShell({
  user,
  groups,
  children,
  alerts,
}: {
  user: { name: string; email: string; role: Role; avatarColor: string };
  groups: { title: string; items: NavItem[] }[];
  children: React.ReactNode;
  alerts: number;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const nav = (
    <nav className="flex h-full flex-col bg-graphite-950 text-white">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <LogoMark size={38} badge />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-white">CSCX</div>
          <div className="text-[11px] text-white/50">Escola Instructiva</div>
        </div>
        <button
          className="ml-auto rounded-lg p-1.5 text-white/60 hover:bg-white/10 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/alunos"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-2 text-xs text-white/50 transition hover:border-white/20 hover:text-white/80"
        >
          <Search className="h-3.5 w-3.5" />
          Buscar aluno…
        </Link>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition',
                        active
                          ? 'bg-white/[0.09] font-medium text-white'
                          : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand-500" />
                      )}
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition',
                          active ? 'text-brand-400' : 'text-white/40 group-hover:text-white/70',
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="ml-auto rounded-full bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-brand-300">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
          <Link
            href="/conta"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg transition hover:opacity-80"
            title="Minha conta"
          >
            <Avatar name={user.name} color={user.avatarColor} size={34} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-white">{user.name}</span>
              <span className="block truncate text-[11px] text-white/45">{ROLE_LABELS[user.role]}</span>
            </span>
          </Link>
          <ThemeToggle tone="dark" className="h-8 w-8 rounded-lg" />
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-[248px] shrink-0 lg:block">
        <div className="sticky top-0 h-screen">{nav}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[270px] shadow-pop">{nav}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/85 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-1.5 text-ink-600 hover:bg-surface-2"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <LogoMark size={28} badge="dark" />
          <span className="text-sm font-semibold text-ink-900">CSCX</span>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle className="h-8 w-8 rounded-lg" />
            <Link
              href="/alertas"
              className="relative grid h-8 w-8 place-items-center rounded-lg text-ink-600 hover:bg-surface-2"
            >
              <Bell className="h-5 w-5" />
              {alerts > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                  {alerts > 9 ? '9+' : alerts}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
