'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/format';

/** Script inline: aplica o tema antes da primeira pintura, evitando piscada. */
export const themeScript = `(function(){try{var t=localStorage.getItem('cscx-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export function ThemeToggle({
  className,
  tone = 'auto',
}: {
  className?: string;
  tone?: 'auto' | 'dark';
}) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const root = document.documentElement;
    const next = !root.classList.contains('dark');
    root.classList.add('theme-switching');
    root.classList.toggle('dark', next);
    try {
      localStorage.setItem('cscx-theme', next ? 'dark' : 'light');
    } catch {
      /* modo privado — segue sem persistir */
    }
    setDark(next);
    window.setTimeout(() => root.classList.remove('theme-switching'), 80);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
      title={dark ? 'Tema claro' : 'Tema escuro'}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-xl border transition',
        tone === 'dark'
          ? 'border-white/15 bg-white/10 text-white hover:bg-white/20'
          : 'border-line bg-surface text-ink-600 hover:bg-surface-2 hover:text-ink-900',
        className,
      )}
    >
      {mounted && dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
