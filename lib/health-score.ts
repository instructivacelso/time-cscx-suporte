/**
 * Motor de Health Score do CSCX.
 *
 * Os pesos abaixo são exatamente os definidos pela Escola Instructiva.
 * Observação importante: a soma dos pesos originais é 110 (e não 100).
 * Por isso o motor **normaliza** os pesos no cálculo — cada indicador
 * contribui com `peso / somaDosPesos * 100`, garantindo que a nota final
 * fique sempre entre 0 e 100 qualquer que seja a calibração escolhida
 * na tela de configuração.
 */

export type HealthIndicatorKey =
  | 'ativacao'
  | 'frequencia'
  | 'progresso'
  | 'engajamento'
  | 'performance'
  | 'relacionamento'
  | 'satisfacao'
  | 'financeiro'
  | 'mentorias';

export type HealthWeights = Record<HealthIndicatorKey, number>;

export const DEFAULT_WEIGHTS: HealthWeights = {
  ativacao: 15,
  frequencia: 15,
  progresso: 20,
  engajamento: 15,
  performance: 10,
  relacionamento: 10,
  satisfacao: 10,
  financeiro: 5,
  mentorias: 10,
};

export const INDICATOR_LABELS: Record<HealthIndicatorKey, string> = {
  ativacao: 'Ativação',
  frequencia: 'Frequência',
  progresso: 'Progresso',
  engajamento: 'Engajamento',
  performance: 'Performance',
  relacionamento: 'Relacionamento',
  satisfacao: 'Satisfação',
  financeiro: 'Financeiro',
  mentorias: 'Participação em mentorias',
};

export const INDICATOR_DESCRIPTIONS: Record<HealthIndicatorKey, string> = {
  ativacao: 'Conclusão do onboarding e dos primeiros passos na plataforma.',
  frequencia: 'Regularidade de acesso nos últimos 30 dias.',
  progresso: 'Avanço no curso comparado ao ritmo esperado.',
  engajamento: 'Aulas, atividades e participação na comunidade.',
  performance: 'Média das avaliações realizadas.',
  relacionamento: 'Contatos e resposta ao time de Customer Success.',
  satisfacao: 'Últimos resultados de NPS e CSAT.',
  financeiro: 'Situação de pagamento das parcelas.',
  mentorias: 'Presença nas mentorias oferecidas no período.',
};

export type HealthThresholds = {
  EXCELENTE: number;
  SAUDAVEL: number;
  ATENCAO: number;
  RISCO: number;
};

export const DEFAULT_THRESHOLDS: HealthThresholds = {
  EXCELENTE: 90,
  SAUDAVEL: 75,
  ATENCAO: 60,
  RISCO: 40,
};

/** Dias de carência para alunos recém-matriculados. */
export const GRACE_DAYS = 7;

export type HealthBandValue = 'EXCELENTE' | 'SAUDAVEL' | 'ATENCAO' | 'RISCO' | 'CRITICO';

export const BAND_LABELS: Record<HealthBandValue, string> = {
  EXCELENTE: 'Excelente',
  SAUDAVEL: 'Saudável',
  ATENCAO: 'Atenção',
  RISCO: 'Risco',
  CRITICO: 'Crítico',
};

export interface HealthInput {
  onboardingPercent: number; // 0-100
  firstLessonDone: boolean;
  daysWithoutAccess: number;
  activeDaysLast30: number;
  expectedActiveDays: number; // meta de dias ativos no período (default 12)
  progressPercent: number; // 0-100
  expectedProgressPercent: number; // 0-100, ritmo esperado pelo cronograma
  lessonsLast30: number;
  activitiesDone: number;
  activitiesTotal: number;
  communityPostsLast30: number;
  gradeAverage: number | null; // 0-10
  interactionsLast60: number;
  answeredInteractionsLast60: number;
  npsLast: number | null; // 0-10
  csatLast: number | null; // 1-5
  paymentStatus: 'EM_DIA' | 'PENDENTE' | 'ATRASADO' | 'INADIMPLENTE' | 'ISENTO';
  overduePayments: number;
  mentorshipsOffered: number;
  mentorshipsAttended: number;
  openComplaints: number;
  /** Dias desde a matrícula. Alunos recém-chegados ganham carência. */
  daysSinceEnrollment?: number;
}

export interface IndicatorResult {
  key: HealthIndicatorKey;
  label: string;
  weight: number;
  normalizedWeight: number;
  rawScore: number; // 0-100
  weightedScore: number;
  reason: string;
  status: 'bom' | 'medio' | 'ruim';
}

export interface HealthResult {
  score: number;
  band: HealthBandValue;
  churnRisk: number;
  breakdown: IndicatorResult[];
  summary: string;
  topRisks: string[];
}

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const r0 = (v: number) => Math.round(v);
const r1 = (v: number) => Math.round(v * 10) / 10;

function statusOf(raw: number): IndicatorResult['status'] {
  if (raw >= 75) return 'bom';
  if (raw >= 50) return 'medio';
  return 'ruim';
}

/* ── Cálculo de cada indicador ─────────────────────────────── */

function calcAtivacao(i: HealthInput) {
  const onboarding = clamp(i.onboardingPercent);
  const bonus = i.firstLessonDone ? 100 : 40;
  const raw = clamp(onboarding * 0.7 + bonus * 0.3);
  const reason = i.firstLessonDone
    ? `Onboarding em ${r0(onboarding)}% e primeira aula já concluída.`
    : `Onboarding em ${r0(onboarding)}% e a primeira aula ainda não foi concluída.`;
  return { raw, reason };
}

function calcFrequencia(i: HealthInput) {
  const target = Math.max(1, i.expectedActiveDays || 12);
  const ratio = clamp((i.activeDaysLast30 / target) * 100);
  const penalty =
    i.daysWithoutAccess >= 30 ? 60 : i.daysWithoutAccess >= 14 ? 35 : i.daysWithoutAccess >= 7 ? 20 : 0;
  const raw = clamp(ratio - penalty);
  const reason =
    i.daysWithoutAccess >= 7
      ? `${i.activeDaysLast30} dias de estudo em 30 (meta ${target}) e ${i.daysWithoutAccess} dias sem acessar a plataforma.`
      : `${i.activeDaysLast30} dias de estudo nos últimos 30 (meta ${target}); último acesso há ${i.daysWithoutAccess} dia(s).`;
  return { raw, reason };
}

function calcProgresso(i: HealthInput) {
  const expected = Math.max(1, i.expectedProgressPercent);
  const adherence = clamp((i.progressPercent / expected) * 100);
  const raw = clamp(adherence * 0.75 + clamp(i.progressPercent) * 0.25);
  const gap = r0(i.progressPercent - i.expectedProgressPercent);
  const reason =
    gap >= 0
      ? `${r0(i.progressPercent)}% do curso concluído — ${gap} p.p. acima do ritmo esperado (${r0(i.expectedProgressPercent)}%).`
      : `${r0(i.progressPercent)}% do curso concluído — ${Math.abs(gap)} p.p. abaixo do ritmo esperado (${r0(i.expectedProgressPercent)}%).`;
  return { raw, reason };
}

function calcEngajamento(i: HealthInput) {
  const lessons = clamp((i.lessonsLast30 / 12) * 100);
  const activities =
    i.activitiesTotal > 0 ? clamp((i.activitiesDone / i.activitiesTotal) * 100) : 50;
  const community = clamp((i.communityPostsLast30 / 4) * 100);
  const raw = clamp(lessons * 0.5 + activities * 0.3 + community * 0.2);
  const reason = `${i.lessonsLast30} aulas em 30 dias, ${i.activitiesDone}/${i.activitiesTotal} atividades entregues e ${i.communityPostsLast30} interações na comunidade.`;
  return { raw, reason };
}

function calcPerformance(i: HealthInput) {
  if (i.gradeAverage === null || Number.isNaN(i.gradeAverage)) {
    return { raw: 55, reason: 'Ainda sem avaliações corrigidas — pontuação neutra aplicada.' };
  }
  const raw = clamp((i.gradeAverage / 10) * 100);
  return {
    raw,
    reason: `Média das avaliações: ${r1(i.gradeAverage)} de 10.`,
  };
}

function calcRelacionamento(i: HealthInput) {
  const contactScore = clamp((i.interactionsLast60 / 4) * 100);
  const responsiveness =
    i.interactionsLast60 > 0
      ? clamp((i.answeredInteractionsLast60 / i.interactionsLast60) * 100)
      : 40;
  const complaintPenalty = clamp(i.openComplaints * 20, 0, 60);
  const raw = clamp(contactScore * 0.45 + responsiveness * 0.55 - complaintPenalty);
  const reason =
    i.interactionsLast60 === 0
      ? 'Nenhum contato registrado com o time de CS nos últimos 60 dias.'
      : `${i.interactionsLast60} contatos em 60 dias, ${i.answeredInteractionsLast60} com retorno do aluno${
          i.openComplaints ? ` e ${i.openComplaints} reclamação(ões) em aberto` : ''
        }.`;
  return { raw, reason };
}

function calcSatisfacao(i: HealthInput) {
  const parts: number[] = [];
  const bits: string[] = [];
  if (i.npsLast !== null && i.npsLast !== undefined) {
    parts.push(clamp((i.npsLast / 10) * 100));
    bits.push(`NPS ${i.npsLast}`);
  }
  if (i.csatLast !== null && i.csatLast !== undefined) {
    parts.push(clamp(((i.csatLast - 1) / 4) * 100));
    bits.push(`CSAT ${r1(i.csatLast)}/5`);
  }
  if (!parts.length) {
    return { raw: 55, reason: 'Sem respostas de NPS ou CSAT registradas — pontuação neutra.' };
  }
  const raw = parts.reduce((a, b) => a + b, 0) / parts.length;
  return { raw, reason: `Últimas respostas: ${bits.join(' e ')}.` };
}

function calcFinanceiro(i: HealthInput) {
  const map: Record<HealthInput['paymentStatus'], number> = {
    ISENTO: 100,
    EM_DIA: 100,
    PENDENTE: 70,
    ATRASADO: 35,
    INADIMPLENTE: 0,
  };
  const base = map[i.paymentStatus];
  const raw = clamp(base - Math.min(i.overduePayments * 10, 30));
  const labels: Record<HealthInput['paymentStatus'], string> = {
    ISENTO: 'Bolsista/isento',
    EM_DIA: 'Pagamentos em dia',
    PENDENTE: 'Parcela pendente',
    ATRASADO: 'Parcela em atraso',
    INADIMPLENTE: 'Situação de inadimplência',
  };
  const reason = i.overduePayments
    ? `${labels[i.paymentStatus]} — ${i.overduePayments} parcela(s) vencida(s).`
    : `${labels[i.paymentStatus]}.`;
  return { raw, reason };
}

function calcMentorias(i: HealthInput) {
  if (i.mentorshipsOffered === 0) {
    return { raw: 55, reason: 'Nenhuma mentoria oferecida no período — pontuação neutra.' };
  }
  const raw = clamp((i.mentorshipsAttended / i.mentorshipsOffered) * 100);
  return {
    raw,
    reason: `Participou de ${i.mentorshipsAttended} de ${i.mentorshipsOffered} mentorias oferecidas.`,
  };
}

const CALCULATORS: Record<HealthIndicatorKey, (i: HealthInput) => { raw: number; reason: string }> = {
  ativacao: calcAtivacao,
  frequencia: calcFrequencia,
  progresso: calcProgresso,
  engajamento: calcEngajamento,
  performance: calcPerformance,
  relacionamento: calcRelacionamento,
  satisfacao: calcSatisfacao,
  financeiro: calcFinanceiro,
  mentorias: calcMentorias,
};

export function bandFor(score: number, thresholds: HealthThresholds = DEFAULT_THRESHOLDS): HealthBandValue {
  if (score >= thresholds.EXCELENTE) return 'EXCELENTE';
  if (score >= thresholds.SAUDAVEL) return 'SAUDAVEL';
  if (score >= thresholds.ATENCAO) return 'ATENCAO';
  if (score >= thresholds.RISCO) return 'RISCO';
  return 'CRITICO';
}

/**
 * Previsão simplificada de evasão (0-100).
 * Combina o Health Score com sinais de alta correlação com churn.
 */
export function estimateChurnRisk(input: HealthInput, score: number) {
  let risk = 100 - score;
  if (input.daysWithoutAccess >= 30) risk += 18;
  else if (input.daysWithoutAccess >= 14) risk += 10;
  else if (input.daysWithoutAccess >= 7) risk += 5;
  if (input.paymentStatus === 'INADIMPLENTE') risk += 15;
  else if (input.paymentStatus === 'ATRASADO') risk += 8;
  if (input.npsLast !== null && input.npsLast <= 6) risk += 8;
  if (input.csatLast !== null && input.csatLast <= 2) risk += 6;
  if (input.progressPercent < input.expectedProgressPercent - 25) risk += 10;
  if (input.openComplaints > 0) risk += 5 * input.openComplaints;
  if (input.onboardingPercent < 50) risk += 6;
  return clamp(r0(risk));
}

export function computeHealthScore(
  input: HealthInput,
  weights: HealthWeights = DEFAULT_WEIGHTS,
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
): HealthResult {
  const keys = Object.keys(CALCULATORS) as HealthIndicatorKey[];
  const totalWeight = keys.reduce((sum, k) => sum + (weights[k] ?? 0), 0) || 1;

  const breakdown: IndicatorResult[] = keys.map((key) => {
    const weight = weights[key] ?? 0;
    const normalizedWeight = (weight / totalWeight) * 100;
    const { raw, reason } = CALCULATORS[key](input);
    const rawScore = r0(clamp(raw));
    return {
      key,
      label: INDICATOR_LABELS[key],
      weight,
      normalizedWeight: r1(normalizedWeight),
      rawScore,
      weightedScore: r1((rawScore * normalizedWeight) / 100),
      reason,
      status: statusOf(rawScore),
    };
  });

  const bruto = clamp(r0(breakdown.reduce((sum, b) => sum + b.weightedScore, 0)));

  /**
   * Carência do aluno novo: nos primeiros dias ninguém tem histórico de
   * estudo, então todos os indicadores nascem zerados e a nota cairia para a
   * faixa crítica sem que nada de errado tenha acontecido. Durante a carência
   * a nota não desce abaixo da faixa de Atenção — o aluno aparece para a
   * equipe cuidar, mas não como risco de evasão.
   */
  const diasDesdeMatricula = input.daysSinceEnrollment ?? Number.POSITIVE_INFINITY;
  const emCarencia = diasDesdeMatricula <= GRACE_DAYS;
  const piso = thresholds.ATENCAO;
  const score = emCarencia ? Math.max(bruto, piso) : bruto;

  const band = bandFor(score, thresholds);
  const churnRisk = emCarencia ? Math.min(estimateChurnRisk(input, score), 20) : estimateChurnRisk(input, score);

  const worst = [...breakdown].sort((a, b) => {
    const lossA = ((100 - a.rawScore) * a.normalizedWeight) / 100;
    const lossB = ((100 - b.rawScore) * b.normalizedWeight) / 100;
    return lossB - lossA;
  });

  const topRisks = worst
    .filter((b) => b.rawScore < 75)
    .slice(0, 3)
    .map((b) => `${b.label}: ${b.reason}`);

  const bestLabel = [...breakdown].sort((a, b) => b.rawScore - a.rawScore)[0];
  const notaCarencia = emCarencia
    ? ` Aluno matriculado há ${Math.max(0, Math.round(diasDesdeMatricula))} dia(s): durante os primeiros ${GRACE_DAYS} dias a nota não desce da faixa de Atenção, porque ainda não há histórico suficiente para avaliar.`
    : '';

  const summary =
    topRisks.length === 0
      ? `Score ${score}/100 (${BAND_LABELS[band]}). Todos os indicadores estão saudáveis; destaque para ${bestLabel.label}.`
      : `Score ${score}/100 (${BAND_LABELS[band]}). Maior perda de pontos em ${worst[0].label} (${worst[0].rawScore}/100), seguido de ${worst[1]?.label ?? '—'}. Ponto forte: ${bestLabel.label} (${bestLabel.rawScore}/100).`;

  return { score, band, churnRisk, breakdown, summary: summary + notaCarencia, topRisks };
}

/** Texto pronto para exibir o "porquê" da nota. */
export function explainScore(result: HealthResult) {
  const lines = result.breakdown
    .slice()
    .sort((a, b) => b.normalizedWeight - a.normalizedWeight)
    .map(
      (b) =>
        `• ${b.label} (peso ${b.weight}, ${b.normalizedWeight}% do total): ${b.rawScore}/100 → +${b.weightedScore} pts. ${b.reason}`,
    );
  return [result.summary, '', ...lines].join('\n');
}
