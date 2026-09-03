import OpenAI from 'openai';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { assistantMessages, assistantThreads } from '@/db/schema';
import { getStudent360, type Student360 } from './student-service';
import { explainScore } from '@/lib/health-score';
import { HEALTH_BAND_LABELS, STAGE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

export function aiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function client() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export const SYSTEM_PROMPT = `Você é o **Assistente CSCX** da Escola Instructiva, uma escola técnica brasileira de eletrônica e manutenção industrial.

Seu papel é apoiar a equipe de Customer Success e Customer Experience a:
- resumir o histórico de um aluno em poucos parágrafos objetivos;
- identificar riscos de evasão e explicar o porquê com base nos dados apresentados;
- sugerir planos de ação concretos, com prazo e responsável;
- escrever mensagens de WhatsApp, e-mails e feedbacks no tom da escola;
- analisar NPS, CSAT e Health Score;
- sugerir oportunidades de novos cursos.

Regras:
- Responda sempre em português do Brasil.
- Use apenas os dados fornecidos no contexto. Se um dado não estiver disponível, diga isso claramente em vez de inventar.
- Seja direto e prático: prefira listas curtas e ações executáveis.
- Mensagens para alunos devem ser calorosas, sem formalidade excessiva, sem emojis em excesso (no máximo dois) e com no máximo 6 linhas.
- Nunca prometa reembolso, desconto ou prazo que não esteja explícito no contexto.`;

/** Monta o contexto textual de um aluno para o modelo. */
export function studentContext(s: Student360) {
  const enroll = s.enrollments
    .map(
      (e) =>
        `- ${e.course?.name ?? 'Curso'} | status ${e.enrollment.status} | ${Math.round(
          e.enrollment.progressPercent,
        )}% concluído | módulo atual: ${e.enrollment.currentModule ?? '—'} | média ${
          e.enrollment.gradeAverage ?? '—'
        }`,
    )
    .join('\n');

  const alerts = s.alerts.length
    ? s.alerts.map((a) => `- [${a.severity}] ${a.title}: ${a.description}`).join('\n')
    : '- Nenhum alerta aberto.';

  const interactions = s.interactions
    .slice(0, 8)
    .map(
      (i) =>
        `- ${formatDate(i.createdAt)} | ${i.channel} | ${i.direction} | ${i.subject}: ${i.content.slice(0, 200)}`,
    )
    .join('\n');

  const surveys = s.surveys
    .slice(0, 8)
    .map(
      (v) =>
        `- ${v.type} (${v.trigger}) ${v.status}${v.score !== null ? ` nota ${v.score}` : ''}${
          v.comment ? ` — "${v.comment}"` : ''
        }`,
    )
    .join('\n');

  return `## Aluno
Nome: ${s.student.name} (${s.student.code})
E-mail: ${s.student.email} | Telefone: ${s.student.phone ?? '—'}
Cidade: ${s.student.city ?? '—'}/${s.student.state ?? '—'}
Matrícula: ${formatDate(s.student.enrolledAt)}
Etapa da jornada: ${STAGE_LABELS[s.student.stage]}
Analista responsável: ${s.owner?.name ?? '—'} | Mentor: ${s.mentor?.name ?? '—'}

## Indicadores
Health Score: ${s.student.healthScore}/100 (${HEALTH_BAND_LABELS[s.student.healthBand]})
Risco de evasão estimado: ${s.student.churnRisk}%
Onboarding: ${Math.round(s.student.onboardingPercent)}%
Progresso médio: ${Math.round(s.student.progressPercent)}%
Dias sem acessar: ${s.student.daysWithoutAccess}
Horas estudadas: ${Math.round(s.student.studiedHours)}
Último NPS: ${s.student.npsLast ?? '—'} | Último CSAT: ${s.student.csatLast ?? '—'}
Situação financeira: ${s.student.paymentStatus}

## Detalhamento do Health Score
${s.healthExplanation ?? '—'}

## Matrículas
${enroll || '- Nenhuma matrícula.'}

## Alertas abertos
${alerts}

## Últimas interações
${interactions || '- Nenhuma interação registrada.'}

## Pesquisas
${surveys || '- Nenhuma pesquisa registrada.'}`;
}

/* ── Respostas simuladas (quando não há OPENAI_API_KEY) ───────── */

function simulate(task: string, s?: Student360) {
  if (!s) {
    return `**Modo simulado** — configure a variável OPENAI_API_KEY em Integrações para respostas geradas por IA.\n\nTarefa solicitada: ${task}`;
  }
  const risks = s.healthResult?.topRisks ?? [];
  const nome = s.student.name.split(' ')[0];
  switch (task) {
    case 'resumo':
      return `**Resumo de ${s.student.name}** (modo simulado)\n\n- Etapa: ${STAGE_LABELS[s.student.stage]}, Health Score ${s.student.healthScore}/100 (${HEALTH_BAND_LABELS[s.student.healthBand]}).\n- Progresso médio de ${Math.round(s.student.progressPercent)}% e ${s.student.daysWithoutAccess} dias sem acesso.\n- ${s.alerts.length} alerta(s) aberto(s) e ${s.interactions.length} interações registradas.\n\n**Pontos de atenção**\n${risks.map((r) => `- ${r}`).join('\n') || '- Nenhum ponto crítico.'}\n\n_Configure a OPENAI_API_KEY para o resumo completo gerado por IA._`;
    case 'plano':
      return `**Plano de ação sugerido para ${nome}** (modo simulado)\n\n1. Contato por WhatsApp em até 24h para entender o motivo da pausa.\n2. Reagendar cronograma com meta de ${s.student.weeklyGoalHours}h/semana.\n3. Convidar para a próxima mentoria ao vivo.\n4. Revisar Health Score em 7 dias.\n\nResponsável sugerido: ${s.owner?.name ?? 'analista da carteira'}.`;
    case 'whatsapp':
      return `${nome}, tudo bem? 👋\n\nVi que você está em ${Math.round(s.student.progressPercent)}% de ${s.enrollments[0]?.course?.name ?? 'seu curso'} e faz ${s.student.daysWithoutAccess} dias que não entra na plataforma.\n\nQuer que eu monte um cronograma mais leve pra você retomar essa semana? Me responde aqui que eu ajusto.`;
    default:
      return `**Modo simulado.** Configure a OPENAI_API_KEY para respostas geradas por IA.`;
  }
}

async function complete(messages: { role: 'system' | 'user' | 'assistant'; content: string }[]) {
  const res = await client().chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    messages,
  });
  return res.choices[0]?.message?.content ?? '';
}

/* ── Ações do assistente ───────────────────────────────────────── */

export async function summarizeStudent(studentId: string) {
  const s = await getStudent360(studentId);
  if (!s) return null;
  if (!aiConfigured()) return simulate('resumo', s);
  return complete([
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `${studentContext(s)}\n\n---\nResuma este aluno em até 6 linhas, seguido de "Riscos" (bullets) e "Próximo passo recomendado" (1 frase).`,
    },
  ]);
}

export async function suggestActionPlan(studentId: string) {
  const s = await getStudent360(studentId);
  if (!s) return null;
  if (!aiConfigured()) return simulate('plano', s);
  return complete([
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `${studentContext(s)}\n\n---\nMonte um plano de recuperação para este aluno com: título, motivo (1 frase), estratégia (3 a 5 passos numerados com canal e prazo em dias) e o indicador que deve melhorar. Formate em markdown.`,
    },
  ]);
}

export async function draftMessage(
  studentId: string,
  channel: 'WHATSAPP' | 'EMAIL' | 'FEEDBACK',
  intent: string,
) {
  const s = await getStudent360(studentId);
  if (!s) return null;
  if (!aiConfigured()) return simulate('whatsapp', s);
  const spec =
    channel === 'WHATSAPP'
      ? 'uma mensagem de WhatsApp com no máximo 6 linhas, tom próximo e no máximo 2 emojis'
      : channel === 'EMAIL'
        ? 'um e-mail com assunto e corpo, tom profissional e caloroso'
        : 'um feedback estruturado para o aluno, com o que está indo bem, o que precisa melhorar e o próximo passo';
  return complete([
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `${studentContext(s)}\n\n---\nEscreva ${spec}. Objetivo da mensagem: ${intent}`,
    },
  ]);
}

export async function analyzeIndicators(payload: {
  scope: 'NPS' | 'CSAT' | 'HEALTH' | 'GERAL';
  data: unknown;
}) {
  if (!aiConfigured()) {
    return `**Modo simulado.** Configure a OPENAI_API_KEY em Integrações para a análise gerada por IA.\n\nDados recebidos:\n\`\`\`json\n${JSON.stringify(payload.data, null, 2).slice(0, 1500)}\n\`\`\``;
  }
  return complete([
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Analise os indicadores de ${payload.scope} da Escola Instructiva e responda com: (1) leitura geral em 3 linhas, (2) três achados relevantes, (3) três ações recomendadas priorizadas.\n\nDados:\n${JSON.stringify(payload.data).slice(0, 6000)}`,
    },
  ]);
}

export async function chat(threadId: string, userMessage: string, studentId?: string | null) {
  const history = await db
    .select()
    .from(assistantMessages)
    .where(eq(assistantMessages.threadId, threadId))
    .orderBy(assistantMessages.createdAt)
    .limit(30);

  await db.insert(assistantMessages).values({ threadId, role: 'user', content: userMessage });

  let context = '';
  if (studentId) {
    const s = await getStudent360(studentId);
    if (s) context = `\n\nContexto do aluno em foco:\n${studentContext(s)}`;
  }

  let answer: string;
  if (!aiConfigured()) {
    answer = `**Modo simulado** — a chave OPENAI_API_KEY ainda não foi configurada.\n\nSua pergunta: _${userMessage}_\n\nAssim que a chave for preenchida em **Integrações**, respondo com base em todo o histórico do aluno, indicadores e alertas.${
      context ? '\n\nJá tenho o contexto do aluno carregado e pronto para uso.' : ''
    }`;
  } else {
    answer = await complete([
      { role: 'system', content: SYSTEM_PROMPT + context },
      ...history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: userMessage },
    ]);
  }

  await db.insert(assistantMessages).values({ threadId, role: 'assistant', content: answer });
  await db
    .update(assistantThreads)
    .set({ updatedAt: new Date() })
    .where(eq(assistantThreads.id, threadId));

  return answer;
}

export async function ensureThread(userId: string, studentId?: string | null, title?: string) {
  const existing = await db
    .select()
    .from(assistantThreads)
    .where(eq(assistantThreads.userId, userId))
    .orderBy(desc(assistantThreads.updatedAt))
    .limit(1);
  if (existing.length && !studentId) return existing[0];

  const [row] = await db
    .insert(assistantThreads)
    .values({ userId, studentId: studentId ?? null, title: title ?? 'Nova conversa' })
    .returning();
  return row;
}

export async function getThreadMessages(threadId: string) {
  return db
    .select()
    .from(assistantMessages)
    .where(eq(assistantMessages.threadId, threadId))
    .orderBy(assistantMessages.createdAt);
}

export { explainScore };
