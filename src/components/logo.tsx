import Image from 'next/image';
import { cn } from '@/lib/format';

/**
 * Símbolo da Escola Instructiva.
 *
 * A figura do logotipo é grafite escuro, então some em fundos escuros.
 * - `badge`      → disco claro sempre (usado sobre a navegação escura)
 * - `badge="dark"` → disco claro só no tema escuro
 */
export function LogoMark({
  size = 36,
  badge = false,
  className,
}: {
  size?: number;
  badge?: boolean | 'dark';
  className?: string;
}) {
  const padded = badge !== false;
  const inner = Math.round(size * (padded ? 0.7 : 1));
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center rounded-2xl',
        badge === true && 'bg-white shadow-sm ring-1 ring-black/5',
        badge === 'dark' && 'dark:bg-white dark:shadow-sm dark:ring-1 dark:ring-white/10',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo.png"
        alt="Escola Instructiva"
        width={inner}
        height={inner}
        priority
        className="object-contain"
      />
    </span>
  );
}

export function Wordmark({
  size = 40,
  badge = 'dark',
  subtitle = 'Escola Instructiva',
  title = 'CSCX',
  className,
  tone = 'light',
}: {
  size?: number;
  badge?: boolean | 'dark';
  subtitle?: string;
  title?: string;
  className?: string;
  /** `dark` = escrito sobre fundo escuro. */
  tone?: 'light' | 'dark';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} badge={badge} />
      <span className="leading-tight">
        <span
          className={cn(
            'block font-display font-semibold tracking-tight',
            size >= 44 ? 'text-lg' : 'text-sm',
            tone === 'dark' ? 'text-white' : 'text-ink-950',
          )}
        >
          {title}
        </span>
        <span className={cn('block text-[11px]', tone === 'dark' ? 'text-white/60' : 'text-ink-500')}>
          {subtitle}
        </span>
      </span>
    </span>
  );
}
