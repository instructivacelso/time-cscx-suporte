/**
 * Scripts de mensagem — acesso ao banco.
 * Os rótulos, as variáveis e os modelos padrão ficam em `@/lib/scripts`.
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { messageScripts } from '@/db/schema';
import type { CanalScript, SituacaoScript } from '@/lib/scripts';

export * from '@/lib/scripts';

export async function listarScripts(opts: { canal?: string; apenasAtivos?: boolean } = {}) {
  const filtros = [];
  if (opts.canal) filtros.push(eq(messageScripts.channel, opts.canal));
  if (opts.apenasAtivos) filtros.push(eq(messageScripts.active, true));

  return db
    .select()
    .from(messageScripts)
    .where(filtros.length ? and(...filtros) : undefined)
    .orderBy(asc(messageScripts.order), asc(messageScripts.title));
}

/* ── Semente inicial ────────────────────────────────────── */

const PADRAO: {
  title: string;
  channel: CanalScript;
  situation: SituacaoScript;
  subject?: string;
  content: string;
  order: number;
}[] = [
  {
    title: 'Boas-vindas',
    channel: 'WHATSAPP',
    situation: 'BOAS_VINDAS',
    order: 10,
    content:
      'Oi, {{nome}}! Seja muito bem-vindo(a) à {{escola}}. Seu acesso a {{curso}} já está liberado. Qualquer dúvida sobre a plataforma ou sobre o conteúdo, é só me chamar por aqui.',
  },
  {
    title: 'Primeiro acesso',
    channel: 'WHATSAPP',
    situation: 'PRIMEIRO_ACESSO',
    order: 20,
    content:
      'Oi, {{nome}}! Aqui é da {{escola}}. Vi que seu acesso a {{curso}} já está liberado, mas você ainda não começou. Precisa de ajuda para entrar ou para saber por onde começar?',
  },
  {
    title: 'Resgate — aluno parado',
    channel: 'WHATSAPP',
    situation: 'RESGATE',
    order: 30,
    content:
      'Oi, {{nome}}! Aqui é da {{escola}}. Notei que faz {{dias_sem_acesso}} dias que você não entra em {{curso}} e queria saber se está tudo bem. Se travou em alguma aula ou apareceu algum imprevisto, me conta que a gente ajusta o ritmo junto.',
  },
  {
    title: 'Acompanhamento',
    channel: 'WHATSAPP',
    situation: 'ACOMPANHAMENTO',
    order: 40,
    content:
      'Oi, {{nome}}! Aqui é da {{escola}}. Passando para saber como está indo em {{curso}}. Está conseguindo acompanhar? Alguma dúvida que eu possa ajudar?',
  },
  {
    title: 'Reta final',
    channel: 'WHATSAPP',
    situation: 'RETA_FINAL',
    order: 50,
    content:
      'Oi, {{nome}}! Você já está em {{progresso}} de {{curso}} — falta pouco para concluir e emitir o certificado. Quer que eu te ajude a fechar essa reta final?',
  },
  {
    title: 'Convite para mentoria',
    channel: 'WHATSAPP',
    situation: 'MENTORIA',
    order: 60,
    content:
      'Oi, {{nome}}! Temos mentoria ao vivo para tirar dúvidas de {{curso}}. Quer que eu te mande o link e o horário da próxima?',
  },
  {
    title: 'Pagamento pendente',
    channel: 'WHATSAPP',
    situation: 'FINANCEIRO',
    order: 70,
    content:
      'Oi, {{nome}}! Tudo bem? Identifiquei uma pendência no seu pagamento aqui na {{escola}}. Se precisar de uma segunda via ou quiser combinar outra data, me avisa que eu resolvo por aqui.',
  },
  {
    title: 'Pedir avaliação (NPS)',
    channel: 'WHATSAPP',
    situation: 'PESQUISA',
    order: 80,
    content:
      'Oi, {{nome}}! Uma perguntinha rápida: de 0 a 10, quanto você recomendaria a {{escola}} para um amigo? Sua resposta ajuda muito a gente a melhorar.',
  },
  {
    title: 'Parabéns pelo certificado',
    channel: 'WHATSAPP',
    situation: 'CERTIFICADO',
    order: 90,
    content:
      'Parabéns, {{nome}}! 🎉 Você concluiu {{curso}} e seu certificado já está disponível. Foi um prazer acompanhar sua evolução — e se quiser seguir para o próximo treinamento, me chama que eu te oriento.',
  },
  {
    title: 'Conversa livre',
    channel: 'WHATSAPP',
    situation: 'GERAL',
    order: 100,
    content: 'Oi, {{nome}}! Aqui é da {{escola}}. Tudo bem?',
  },
  {
    title: 'Boas-vindas + tutorial',
    channel: 'EMAIL',
    situation: 'BOAS_VINDAS',
    order: 110,
    subject: 'Bem-vindo(a) à {{escola}}, {{nome}}!',
    content:
      'Olá, {{nome}},\n\nSeja muito bem-vindo(a) à {{escola}}! Seu acesso a {{curso}} já está liberado.\n\nPara começar bem:\n• assista à aula de abertura;\n• separe um horário fixo na semana para estudar;\n• entre na comunidade e se apresente.\n\nAcesso: {{link}}\n\nQualquer dúvida, é só responder este e-mail.\n\nAbraço,\n{{analista}}',
  },
  {
    title: 'Retomada de estudos',
    channel: 'EMAIL',
    situation: 'RESGATE',
    order: 120,
    subject: '{{nome}}, vamos retomar {{curso}}?',
    content:
      'Olá, {{nome}},\n\nNotamos que faz {{dias_sem_acesso}} dias desde o seu último acesso a {{curso}}.\n\nSe algo atrapalhou — falta de tempo, dúvida travando ou dificuldade técnica — responda este e-mail contando. A gente reorganiza seu cronograma junto com você.\n\nAcesso: {{link}}\n\nAbraço,\n{{analista}}',
  },
];

/** Cria os scripts padrão se ainda não houver nenhum. Idempotente. */
export async function ensureScriptsPadrao() {
  const existentes = await db.select({ id: messageScripts.id }).from(messageScripts).limit(1);
  if (existentes.length) return 0;

  await db.insert(messageScripts).values(
    PADRAO.map((p) => ({
      title: p.title,
      channel: p.channel,
      situation: p.situation,
      subject: p.subject ?? null,
      content: p.content,
      order: p.order,
    })),
  );
  return PADRAO.length;
}
