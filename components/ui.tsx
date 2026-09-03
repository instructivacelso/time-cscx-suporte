import type { ReactNode } from 'react';
import { cn, initials } from '@/lib/format';
import { HEALTH_BAND_EMOJI, HEALTH_BAND_LABELS, HEALTH_BAND_VAR } from '@/lib/constants';
import type { HealthBand } from '@/db/schema';

export function Card({
  children,
  className,
  padded = true,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  hover?: boolean;
}) {
  return (
    <div className={cn('card', padded && 'card-pad', hover && 'card-hover', className)}>
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-ink-950 sm:text-[26px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const ACCENTS: Record<string, string> = {
  brand: 'bg-brand-500/12 text-brand-600 dark:text-brand-500',
  green: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  red: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
  ink: 'bg-ink-500/12 text-ink-600',
  violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
};

export function KpiCard({
  label,
  value,
  hint,
  trend,
  accent = 'brand',
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: { value: number; suffix?: string; inverse?: boolean };
  accent?: 'brand' | 'green' | 'amber' | 'red' | 'ink' | 'violet';
  icon?: ReactNode;
}) {
  const positive = trend ? (trend.inverse ? trend.value <= 0 : trend.value >= 0) : true;
  // Valores longos (moeda, por exemplo) reduzem o corpo para não estourar o cartão.
  const len = typeof value === 'string' || typeof value === 'number' ? String(value).length : 0;
  const size = len > 11 ? 'text-[19px]' : len > 8 ? 'text-[22px]' : 'text-[26px]';
  return (
    <div className="card card-pad animate-fade-in transition duration-200 hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <span className="label">{label}</span>
        {icon && (
          <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', ACCENTS[accent])}>
            {icon}
          </span>
        )}
      </div>
      <div
        className={cn(
          'mt-2 truncate font-display font-semibold leading-none tracking-tight text-ink-950',
          size,
        )}
        title={len ? String(value) : undefined}
      >
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              'chip px-1.5 py-0.5 text-[11px]',
              positive
                ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
            )}
          >
            {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}
            {trend.suffix ?? '%'}
          </span>
        )}
        {hint && <span className="text-xs text-ink-500">{hint}</span>}
      </div>
    </div>
  );
}

export function HealthBadge({
  band,
  score,
  size = 'md',
}: {
  band: HealthBand;
  score?: number;
  size?: 'sm' | 'md';
}) {
  const v = HEALTH_BAND_VAR[band];
  return (
    <span
      className={cn('chip border', size === 'sm' ? 'text-[11px]' : 'text-xs')}
      style={{
        backgroundColor: `rgb(var(${v}) / 0.12)`,
        color: `rgb(var(${v}))`,
        borderColor: `rgb(var(${v}) / 0.28)`,
      }}
    >
      <span aria-hidden>{HEALTH_BAND_EMOJI[band]}</span>
      {score !== undefined ? `${score} · ` : ''}
      {HEALTH_BAND_LABELS[band]}
    </span>
  );
}

const TONES: Record<string, string> = {
  ink: 'bg-ink-500/12 text-ink-600',
  brand: 'bg-brand-500/12 text-brand-600 dark:text-brand-500',
  green: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  red: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
  violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
};

export function Badge({
  children,
  tone = 'ink',
  className,
}: {
  children: ReactNode;
  tone?: 'ink' | 'brand' | 'green' | 'amber' | 'red' | 'violet';
  className?: string;
}) {
  return <span className={cn('chip', TONES[tone], className)}>{children}</span>;
}

export function Progress({
  value,
  tone = 'brand',
  showLabel = false,
  className,
}: {
  value: number;
  tone?: 'brand' | 'green' | 'amber' | 'red';
  showLabel?: boolean;
  className?: string;
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-500',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-rose-500',
  };
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-500/15">
        <div
          className={cn('h-full rounded-full transition-all duration-500', tones[tone])}
          style={{ width: `${v}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-ink-500">
          {Math.round(v)}%
        </span>
      )}
    </div>
  );
}

export function Avatar({
  name,
  color = '#e85806',
  size = 32,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        background: `linear-gradient(140deg, ${color}, ${color}cc)`,
        width: size,
        height: size,
        fontSize: size * 0.36,
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/70 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-ink-300">{icon}</div>}
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink-900">{value}</div>
    </div>
  );
}

export function Divider() {
  return <div className="my-4 h-px w-full bg-line" />;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { tone: Parameters<typeof Badge>[0]['tone']; label: string }> = {
    INFO: { tone: 'ink', label: 'Info' },
    ATENCAO: { tone: 'amber', label: 'Atenção' },
    ALTA: { tone: 'red', label: 'Alta' },
    CRITICA: { tone: 'red', label: 'Crítica' },
  };
  const it = map[severity] ?? map.INFO;
  return <Badge tone={it.tone}>{it.label}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, Parameters<typeof Badge>[0]['tone']> = {
    ABERTO: 'amber',
    ABERTA: 'amber',
    EM_TRATATIVA: 'brand',
    EM_ANDAMENTO: 'brand',
    EM_EXECUCAO: 'brand',
    RESOLVIDO: 'green',
    CONCLUIDA: 'green',
    CONCLUIDO: 'green',
    IGNORADO: 'ink',
    CANCELADA: 'ink',
    CANCELADO: 'ink',
    SEM_SUCESSO: 'red',
    ATIVA: 'green',
    PAUSADA: 'amber',
    INADIMPLENTE: 'red',
    ATRASADO: 'red',
    EM_DIA: 'green',
    ISENTO: 'violet',
    RESPONDIDA: 'green',
    ENVIADA: 'brand',
    ENVIADO: 'green',
    SIMULADO: 'violet',
    AGENDADO: 'amber',
    FALHOU: 'red',
    PENDENTE: 'amber',
    EXPIRADA: 'ink',
    AGUARDANDO_ALUNO: 'violet',
    FECHADO: 'ink',
  };
  return <Badge tone={map[status] ?? 'ink'}>{status.replaceAll('_', ' ').toLowerCase()}</Badge>;
}
