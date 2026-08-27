import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  automationRuns,
  automations,
  interactions,
  students,
  tasks,
  type Automation,
} from '@/db/schema';
import { renderTemplate, sendEmail, sendWhatsApp } from './messaging';

export type Trigger = Automation['trigger'];

/** Catálogo padrão de automações da Escola Instructiva. */
export const DEFAULT_AUTOMATIONS: Array<{
  name: string;
  trigger: Trigger;
  channel: Automation['channel'];
  description: string;
  template: string;
  delayHours: number;
}> = [
  {
    name: 'Boas-vindas ao novo aluno',
    trigger: 'NOVO_ALUNO',
    channel: 'WHATSAPP',
    description: 'Dispara imediatamente após a matrícula, abrindo o onboarding.',
    template:
      'Olá {{primeiroNome}}! 👋 Aqui é a equipe da Escola Instructiva. Sua matrícula em {{curso}} está confirmada!\n\nSeu acesso já está liberado. Comece por aqui: {{linkPlataforma}}\n\nQualquer dúvida, é só responder esta mensagem. Bons estudos!',
    delayHours: 0,
  },
  {
    name: 'E-mail de boas-vindas + tutorial',
    trigger: 'NOVO_ALUNO',
    channel: 'EMAIL',
    description: 'Envia vídeo institucional e tutorial da plataforma.',
    template:
      'Olá {{primeiroNome}},\n\nSeja muito bem-vindo(a) à Escola Instructiva!\n\n• Vídeo institucional: {{linkVideo}}\n• Tutorial da plataforma: {{linkTutorial}}\n• Seu curso: {{curso}}\n• Seu mentor: {{mentor}}\n\nSeu analista de sucesso é {{analista}} e acompanha sua jornada de perto.\n\nEquipe Escola Instructiva',
    delayHours: 0,
  },
  {
    name: 'Resgate de aluno parado',
    trigger: 'ALUNO_PARADO',
    channel: 'WHATSAPP',
    description: 'Aluno com 7 dias ou mais sem acessar a plataforma.',
    template:
      '{{primeiroNome}}, sentimos sua falta! 🙂 Faz {{diasSemAcesso}} dias que você não entra na plataforma.\n\nVocê está em {{progresso}}% de {{curso}}. Que tal retomar hoje com uma aula de 15 minutos?\n\nSe algo travou seu estudo, me conta que a gente ajusta seu cronograma.',
    delayHours: 0,
  },
  {
    name: 'Reta final do curso',
    trigger: 'ALUNO_CONCLUINDO',
    channel: 'WHATSAPP',
    description: 'Aluno acima de 80% de progresso.',
    template:
      'Falta pouco, {{primeiroNome}}! 🎯 Você já concluiu {{progresso}} % de {{curso}}.\n\nVamos fechar o certificado ainda este mês? Posso reservar uma mentoria de reta final para você.',
    delayHours: 0,
  },
  {
    name: 'Parabéns pela certificação',
    trigger: 'ALUNO_CERTIFICADO',
    channel: 'EMAIL',
    description: 'Certificado emitido — parabeniza e pede depoimento.',
    template:
      'Parabéns, {{primeiroNome}}! 🎉\n\nVocê concluiu {{curso}} e seu certificado já está disponível na plataforma.\n\nSua opinião vale muito: nos conte em uma frase o que mudou na sua rotina técnica depois do curso.\n\nEquipe Escola Instructiva',
    delayHours: 0,
  },
  {
    name: 'Alerta interno de aluno em risco',
    trigger: 'ALUNO_EM_RISCO',
    channel: 'TAREFA_INTERNA',
    description: 'Cria tarefa para o analista responsável iniciar plano de recuperação.',
    template:
      'Contatar {{nome}} — Health Score {{healthScore}} ({{faixa}}), risco de evasão {{riscoEvasao}}%. Motivo principal: {{motivo}}.',
    delayHours: 0,
  },
  {
    name: 'Convite ao programa de indicação',
    trigger: 'ALUNO_PROMOTOR',
    channel: 'WHATSAPP',
    description: 'Aluno promotor (NPS 9 ou 10) recebe convite de indicação.',
    template:
      '{{primeiroNome}}, obrigado pela nota {{nps}} na nossa pesquisa! 🙏\n\nComo você curtiu a experiência, quer indicar um colega? Ele ganha condição especial e você ganha bônus no próximo curso: {{linkIndicacao}}',
    delayHours: 0,
  },
  {
    name: 'Confirmação de pagamento',
    trigger: 'PAGAMENTO_CONFIRMADO',
    channel: 'EMAIL',
    description: 'Confirma o recebimento e reforça o acesso liberado.',
    template:
      'Olá {{primeiroNome}}, recebemos seu pagamento de {{valor}} referente a {{referencia}}. Acesso liberado e tudo em dia por aqui. Bons estudos!',
    delayHours: 0,
  },
  {
    name: 'Lembrete de pagamento pendente',
    trigger: 'PAGAMENTO_PENDENTE',
    channel: 'WHATSAPP',
    description: 'Aviso amigável antes da suspensão do acesso.',
    template:
      '{{primeiroNome}}, tudo bem? Identificamos a parcela {{referencia}} de {{valor}} em aberto desde {{vencimento}}.\n\nSe precisar de uma nova data ou segunda via, me avise que resolvemos rapidinho.',
    delayHours: 0,
  },
  {
    name: 'Pesquisa de NPS',
    trigger: 'PESQUISA_NPS',
    channel: 'WHATSAPP',
    description: 'Envia a pergunta de NPS em D+30, D+60, D+90 e na conclusão.',
    template:
      '{{primeiroNome}}, uma pergunta rápida (leva 10 segundos):\n\nDe 0 a 10, quanto você recomendaria a Escola Instructiva para um amigo?\n\nResponder: {{linkPesquisa}}',
    delayHours: 0,
  },
  {
    name: 'Pesquisa de CSAT pós-atendimento',
    trigger: 'PESQUISA_CSAT',
    channel: 'WHATSAPP',
    description: 'Enviada após atendimento, mentoria, onboarding e conclusão.',
    template:
      '{{primeiroNome}}, como você avalia o atendimento que acabou de receber? ⭐️\n\nDe 1 a 5 estrelas: {{linkPesquisa}}',
    delayHours: 1,
  },
  {
    name: 'Parabéns por conclusão de módulo',
    trigger: 'PARABENS_CONCLUSAO',
    channel: 'PLATAFORMA',
    description: 'Reconhecimento a cada marco de progresso.',
    template: 'Mandou bem, {{primeiroNome}}! Você concluiu {{progresso}}% de {{curso}}. Siga firme! 💪',
    delayHours: 0,
  },
  {
    name: 'Oferta de novos cursos (egresso)',
    trigger: 'OFERTA_NOVOS_CURSOS',
    channel: 'EMAIL',
    description: 'Oferta de expansão para alunos certificados e promotores.',
    template:
      'Olá {{primeiroNome}},\n\nComo egresso de {{curso}}, você tem condição especial nos próximos treinamentos.\n\nSugestão para o seu momento: {{sugestaoCurso}}\n\nQuer que eu reserve sua vaga?',
    delayHours: 0,
  },
];

export async function ensureDefaultAutomations() {
  const existing = await db.select({ name: automations.name }).from(automations);
  const names = new Set(existing.map((e) => e.name));
  const missing = DEFAULT_AUTOMATIONS.filter((a) => !names.has(a.name));
  if (missing.length) await db.insert(automations).values(missing);
}

export interface AutomationContext {
  studentId: string;
  vars?: Record<string, string | number | null | undefined>;
  dryRun?: boolean;
}

/** Executa todas as automações ativas de um gatilho para um aluno. */
export async function runAutomations(trigger: Trigger, ctx: AutomationContext) {
  const [student] = await db.select().from(students).where(eq(students.id, ctx.studentId));
  if (!student) return [];

  const rules = await db
    .select()
    .from(automations)
    .where(and(eq(automations.trigger, trigger), eq(automations.active, true)));

  const baseVars: Record<string, string | number | null | undefined> = {
    nome: student.name,
    primeiroNome: student.name.split(' ')[0],
    email: student.email,
    telefone: student.phone ?? '',
    healthScore: student.healthScore,
    faixa: student.healthBand,
    riscoEvasao: student.churnRisk,
    progresso: Math.round(student.progressPercent),
    diasSemAcesso: student.daysWithoutAccess,
    nps: student.npsLast ?? '',
    linkPlataforma: process.env.LMS_STUDENT_URL ?? 'https://escolainstructiva.com.br/aluno',
    linkVideo: process.env.WELCOME_VIDEO_URL ?? 'https://escolainstructiva.com.br/boas-vindas',
    linkTutorial: process.env.TUTORIAL_URL ?? 'https://escolainstructiva.com.br/tutorial',
    linkIndicacao: process.env.REFERRAL_URL ?? 'https://escolainstructiva.com.br/indique',
    ...ctx.vars,
  };

  const results = [];

  for (const rule of rules) {
    const body = renderTemplate(rule.template, baseVars);
    const scheduledFor = rule.delayHours
      ? new Date(Date.now() + rule.delayHours * 3_600_000)
      : new Date();

    if (ctx.dryRun) {
      results.push({ rule: rule.name, channel: rule.channel, body, status: 'SIMULADO' as const });
      continue;
    }

    let status: 'ENVIADO' | 'SIMULADO' | 'FALHOU' | 'AGENDADO' = 'SIMULADO';
    let error: string | null = null;

    if (rule.delayHours > 0) {
      status = 'AGENDADO';
    } else if (rule.channel === 'WHATSAPP') {
      const res = await sendWhatsApp(student.phone ?? '', body);
      status = res.ok ? (res.simulated ? 'SIMULADO' : 'ENVIADO') : 'FALHOU';
      error = res.error ?? null;
    } else if (rule.channel === 'EMAIL') {
      const res = await sendEmail(student.email, rule.name, body);
      status = res.ok ? (res.simulated ? 'SIMULADO' : 'ENVIADO') : 'FALHOU';
      error = res.error ?? null;
    } else if (rule.channel === 'TAREFA_INTERNA') {
      await db.insert(tasks).values({
        studentId: student.id,
        ownerId: student.ownerId,
        title: body.split('\n')[0].slice(0, 180),
        description: body,
        priority: student.churnRisk >= 70 ? 'URGENTE' : 'ALTA',
        dueAt: new Date(Date.now() + 2 * 86_400_000),
      });
      status = 'ENVIADO';
    } else if (rule.channel === 'PLATAFORMA') {
      status = 'ENVIADO';
    }

    if (rule.channel !== 'TAREFA_INTERNA' && status !== 'FALHOU') {
      await db.insert(interactions).values({
        studentId: student.id,
        channel: rule.channel === 'WHATSAPP' ? 'WHATSAPP' : rule.channel === 'EMAIL' ? 'EMAIL' : 'PLATAFORMA',
        direction: 'SAIDA',
        subject: `[Automação] ${rule.name}`,
        content: body,
      });
    }

    await db.insert(automationRuns).values({
      automationId: rule.id,
      studentId: student.id,
      status,
      payload: { body, channel: rule.channel } as never,
      error,
      scheduledFor,
      executedAt: status === 'AGENDADO' ? null : new Date(),
    });

    results.push({ rule: rule.name, channel: rule.channel, body, status });
  }

  return results;
}

export async function listAutomations() {
  return db.select().from(automations).orderBy(automations.trigger, automations.name);
}

export async function automationStats() {
  const rows = await db
    .select({
      automationId: automationRuns.automationId,
      status: automationRuns.status,
      total: sql<number>`count(*)::int`,
    })
    .from(automationRuns)
    .groupBy(automationRuns.automationId, automationRuns.status);
  return rows;
}

export async function recentRuns(limit = 60) {
  return db
    .select({
      run: automationRuns,
      automation: { id: automations.id, name: automations.name, channel: automations.channel },
      student: { id: students.id, name: students.name },
    })
    .from(automationRuns)
    .innerJoin(automations, eq(automationRuns.automationId, automations.id))
    .innerJoin(students, eq(automationRuns.studentId, students.id))
    .orderBy(desc(automationRuns.createdAt))
    .limit(limit);
}
