import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR');
const DEC1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const money = (v: number | string | null | undefined) => BRL.format(Number(v ?? 0));
export const num = (v: number | null | undefined) => NUM.format(Number(v ?? 0));
export const dec1 = (v: number | null | undefined) => DEC1.format(Number(v ?? 0));
export const pct = (v: number | null | undefined, digits = 0) =>
  `${Number(v ?? 0).toFixed(digits).replace('.', ',')}%`;

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeDays(d: Date | string | null | undefined) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'há 1 mês' : `há ${months} meses`;
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function firstName(name: string) {
  return name.split(' ')[0] ?? name;
}

/** Formata telefone brasileiro: 5511987654321 → +55 (11) 98765-4321 */
export function formatPhone(raw: string | null | undefined) {
  if (!raw) return '—';
  const d = String(raw).replace(/\D/g, '');
  const local = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  if (rest.length < 8) return raw;
  const body = rest.length >= 9 ? `${rest.slice(0, 5)}-${rest.slice(5, 9)}` : `${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
  return `(${ddd}) ${body}`;
}
