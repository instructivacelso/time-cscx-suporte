'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from 'recharts';
import { HEALTH_BAND_LABELS, STAGE_LABELS } from '@/lib/constants';

/**
 * Paleta categórica validada para contraste e daltonismo.
 * Slots fixos — a cor acompanha a série, nunca a posição no ranking.
 * Cada tema tem seu próprio degrau da mesma matiz.
 */
const PALETTE = {
  light: {
    s1: '#2a78d6', // azul
    s2: '#eb6834', // laranja
    s3: '#1baf7a', // aqua
    s4: '#eda100', // amarelo
    axis: '#7c7870',
    grid: '#e6e3de',
    label: '#48453f',
    cursor: 'rgba(0,0,0,.04)',
    ring: '#ffffff',
    funnel: [
      '#0d366b', '#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6',
      '#3987e5', '#5598e7', '#6da7ec', '#86b6ef', '#9ec5f4',
    ],
    health: {
      EXCELENTE: '#0d9460',
      SAUDAVEL: '#22a560',
      ATENCAO: '#d99800',
      RISCO: '#e27418',
      CRITICO: '#d8332f',
    },
  },
  dark: {
    s1: '#5aa0f0',
    s2: '#f07a45',
    s3: '#2fc08c',
    s4: '#e8b13c',
    axis: '#9b99a0',
    grid: '#303036',
    label: '#c9c7cd',
    cursor: 'rgba(255,255,255,.05)',
    ring: '#1a1a1d',
    funnel: [
      '#123a70', '#17498a', '#1d5aa6', '#246cc1', '#2d7ed8', '#3b8de6',
      '#529ceb', '#6aabef', '#84baf3', '#9dc8f6', '#b6d5f9',
    ],
    health: {
      EXCELENTE: '#34c784',
      SAUDAVEL: '#4ace7a',
      ATENCAO: '#f0b933',
      RISCO: '#f8963e',
      CRITICO: '#f86864',
    },
  },
};

export const SERIES = PALETTE.light;

/** Observa a classe `dark` no <html> e devolve a paleta correspondente. */
function useTokens() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains('dark'));
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return dark ? PALETTE.dark : PALETTE.light;
}

function TooltipBox({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string | number;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-pop">
      {label !== undefined && (
        <div className="mb-1 text-xs font-semibold text-ink-900">{String(label)}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-ink-700">
          <span
            className="inline-block h-2 w-2 rounded-full ring-2 ring-surface"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-ink-600">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums text-ink-900">
            {p.value}
            {suffix ?? ''}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Os gráficos medem a largura do contêiner, que só existe no navegador.
 * Renderizar no servidor causaria divergência de hidratação — por isso a
 * marcação entra depois da montagem, com um espaço reservado do mesmo
 * tamanho para não haver salto de layout.
 */
function Frame({ height, children }: { height: number; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div style={{ height }} className="w-full animate-pulse rounded-lg bg-surface-2" aria-hidden />;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children as never}
    </ResponsiveContainer>
  );
}

const legendStyle = (color: string) => ({ fontSize: 11, color, paddingTop: 8 });

export function MonthlyEvolutionChart({
  data,
}: {
  data: { label: string; matriculas: number; conclusoes: number; cancelamentos: number }[];
}) {
  const t = useTokens();
  const axis = { fontSize: 11, fill: t.axis };
  return (
    <Frame height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: t.cursor }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle(t.label)} />
        <Bar isAnimationActive={false} dataKey="matriculas" name="Matrículas" fill={t.s1} radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Bar isAnimationActive={false} dataKey="conclusoes" name="Conclusões" fill={t.s3} radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Bar isAnimationActive={false} dataKey="cancelamentos" name="Cancelamentos" fill={t.s2} radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </Frame>
  );
}

export function NpsTrendChart({ data }: { data: { month: string; nps: number; respostas: number }[] }) {
  const t = useTokens();
  const axis = { fontSize: 11, fill: t.axis };
  // Meses sem resposta ficam vazios em vez de virar um falso zero.
  const rows = data.map((d) => ({
    ...d,
    nps: d.respostas > 0 ? d.nps : null,
    label: `${d.month.slice(5)}/${d.month.slice(2, 4)}`,
  }));
  return (
    <Frame height={240}>
      <LineChart data={rows} margin={{ top: 14, right: 16, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} width={44} domain={[-100, 100]} />
        <Tooltip content={<TooltipBox />} />
        <Line
          isAnimationActive={false}
          type="monotone"
          dataKey="nps"
          name="NPS"
          stroke={t.s1}
          strokeWidth={2}
          connectNulls
          dot={{ r: 4, strokeWidth: 2, stroke: t.ring, fill: t.s1 }}
          activeDot={{ r: 6, strokeWidth: 2, stroke: t.ring }}
        >
          <LabelList dataKey="nps" position="top" style={{ fontSize: 11, fill: t.label }} />
        </Line>
      </LineChart>
    </Frame>
  );
}

export function HealthDistributionChart({ data }: { data: { band: string; total: number }[] }) {
  const t = useTokens();
  const axis = { fontSize: 11, fill: t.axis };
  const order = ['EXCELENTE', 'SAUDAVEL', 'ATENCAO', 'RISCO', 'CRITICO'] as const;
  const rows = order.map((band) => ({
    band,
    label: HEALTH_BAND_LABELS[band],
    total: data.find((d) => d.band === band)?.total ?? 0,
  }));
  return (
    <Frame height={220}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={t.grid} horizontal={false} />
        <XAxis type="number" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={axis} axisLine={false} tickLine={false} width={80} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: t.cursor }} />
        <Bar isAnimationActive={false} dataKey="total" name="Alunos" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {rows.map((r) => (
            <Cell key={r.band} fill={t.health[r.band]} />
          ))}
          <LabelList dataKey="total" position="right" style={{ fontSize: 11, fill: t.label }} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

export function EngagementChart({ data }: { data: { label: string; horas: number; alunos: number }[] }) {
  const t = useTokens();
  const axis = { fontSize: 11, fill: t.axis };
  return (
    <Frame height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gradEng" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.s1} stopOpacity={0.3} />
            <stop offset="100%" stopColor={t.s1} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} minTickGap={18} />
        <YAxis tick={axis} axisLine={false} tickLine={false} width={44} />
        <Tooltip content={<TooltipBox suffix="h" />} />
        <Area
          isAnimationActive={false}
          type="monotone"
          dataKey="horas"
          name="Horas estudadas"
          stroke={t.s1}
          strokeWidth={2}
          fill="url(#gradEng)"
        />
      </AreaChart>
    </Frame>
  );
}

export function FunnelChart({ data }: { data: { stage: string; total: number }[] }) {
  const t = useTokens();
  const axis = { fontSize: 11, fill: t.axis };
  const rows = data.map((d, i) => ({
    label: STAGE_LABELS[d.stage as keyof typeof STAGE_LABELS] ?? d.stage,
    total: d.total,
    fill: t.funnel[Math.min(i, t.funnel.length - 1)],
  }));
  return (
    <Frame height={340}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 34, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={t.grid} horizontal={false} />
        <XAxis type="number" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={axis} axisLine={false} tickLine={false} width={130} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: t.cursor }} />
        <Bar isAnimationActive={false} dataKey="total" name="Alunos" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.fill} />
          ))}
          <LabelList dataKey="total" position="right" style={{ fontSize: 11, fill: t.label }} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

export function CsatDistributionChart({ data }: { data: { star: number; total: number }[] }) {
  const t = useTokens();
  const axis = { fontSize: 11, fill: t.axis };
  const rows = data.map((d) => ({ label: `${d.star} ★`, total: d.total }));
  return (
    <Frame height={200}>
      <BarChart data={rows} margin={{ top: 16, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: t.cursor }} />
        <Bar isAnimationActive={false} dataKey="total" name="Respostas" fill={t.s1} radius={[4, 4, 0, 0]} maxBarSize={38}>
          <LabelList dataKey="total" position="top" style={{ fontSize: 11, fill: t.label }} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

export function HealthHistoryChart({
  data,
}: {
  data: { date: string; score: number; churn: number }[];
}) {
  const t = useTokens();
  const axis = { fontSize: 11, fill: t.axis };
  const rows = data.map((d) => ({ ...d, label: d.date.slice(8) + '/' + d.date.slice(5, 7) }));
  return (
    <Frame height={200}>
      <LineChart data={rows} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} minTickGap={20} />
        <YAxis tick={axis} axisLine={false} tickLine={false} width={40} domain={[0, 100]} />
        <Tooltip content={<TooltipBox />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle(t.label)} />
        <Line isAnimationActive={false} type="monotone" dataKey="score" name="Health Score" stroke={t.s1} strokeWidth={2} dot={false} />
        <Line isAnimationActive={false} type="monotone" dataKey="churn" name="Risco de evasão" stroke={t.s2} strokeWidth={2} dot={false} />
      </LineChart>
    </Frame>
  );
}

export function StudyChart({ data }: { data: { day: string; minutos: number }[] }) {
  const t = useTokens();
  const axis = { fontSize: 11, fill: t.axis };
  const rows = data.slice(-45).map((d) => ({
    label: d.day.slice(8) + '/' + d.day.slice(5, 7),
    horas: Math.round((d.minutos / 60) * 10) / 10,
  }));
  return (
    <Frame height={200}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} minTickGap={14} />
        <YAxis tick={axis} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => `${v}h`} />
        <Tooltip content={<TooltipBox suffix="h" />} cursor={{ fill: t.cursor }} />
        <Bar isAnimationActive={false} dataKey="horas" name="Horas" fill={t.s1} radius={[3, 3, 0, 0]} maxBarSize={14} />
      </BarChart>
    </Frame>
  );
}

export function CourseChart({
  data,
}: {
  data: { course: string; alunos: number; conclusao: number }[];
}) {
  const t = useTokens();
  const axis = { fontSize: 11, fill: t.axis };
  const rows = data.slice(0, 8).map((d) => ({
    label: d.course.length > 26 ? `${d.course.slice(0, 25)}…` : d.course,
    alunos: d.alunos,
    conclusao: d.conclusao,
  }));
  return (
    <Frame height={Math.max(200, rows.length * 42)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 34, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={t.grid} horizontal={false} />
        <XAxis type="number" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={axis} axisLine={false} tickLine={false} width={170} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: t.cursor }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle(t.label)} />
        <Bar isAnimationActive={false} dataKey="alunos" name="Alunos" fill={t.s1} radius={[0, 4, 4, 0]} maxBarSize={12} />
        <Bar isAnimationActive={false} dataKey="conclusao" name="Conclusão (%)" fill={t.s3} radius={[0, 4, 4, 0]} maxBarSize={12} />
      </BarChart>
    </Frame>
  );
}
