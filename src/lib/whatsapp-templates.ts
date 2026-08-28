/**
 * Mensagens prontas do botão "Chamar no WhatsApp".
 *
 * São sugestões, não envios automáticos: o texto abre já escrito na conversa e
 * a pessoa revisa antes de mandar. Por isso o tom é de conversa, não de robô.
 */
import type { ModeloMensagem } from '@/components/whatsapp-button';

export interface ContextoAluno {
  nome: string;
  curso: string | null;
  diasSemAcesso: number;
  progresso: number;
  etapa: string;
  escola?: string;
  linkAmbiente?: string | null;
}

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0];

export function montarModelosWhatsapp(ctx: ContextoAluno): ModeloMensagem[] {
  const nome = primeiroNome(ctx.nome);
  const escola = ctx.escola ?? 'Escola Instructiva';
  const curso = ctx.curso ?? 'seu curso';
  const link = ctx.linkAmbiente ? `\n\nSeu acesso: ${ctx.linkAmbiente}` : '';

  const modelos: ModeloMensagem[] = [];

  /* A primeira da lista é a que o botão dispara direto — por isso ela muda
     conforme a situação do aluno. */

  if (ctx.diasSemAcesso >= 7) {
    modelos.push({
      chave: 'resgate',
      titulo: 'Resgate — aluno parado',
      texto: `Oi, ${nome}! Aqui é da ${escola}. Notei que faz um tempinho que você não entra em ${curso} e queria saber se está tudo bem. Se travou em alguma aula ou apareceu algum imprevisto, me conta que a gente ajusta o ritmo junto.`,
    });
  }

  if (ctx.progresso === 0 && ctx.diasSemAcesso < 7) {
    modelos.push({
      chave: 'primeiro-acesso',
      titulo: 'Primeiro acesso',
      texto: `Oi, ${nome}! Aqui é da ${escola}. Vi que seu acesso a ${curso} já está liberado, mas você ainda não começou. Precisa de ajuda para entrar ou para saber por onde começar?${link}`,
    });
  }

  modelos.push({
    chave: 'boas-vindas',
    titulo: 'Boas-vindas',
    texto: `Oi, ${nome}! Seja muito bem-vindo(a) à ${escola}. Seu acesso a ${curso} já está liberado. Qualquer dúvida sobre a plataforma ou sobre o conteúdo, é só me chamar por aqui.${link}`,
  });

  if (ctx.progresso >= 80 && ctx.progresso < 100) {
    modelos.push({
      chave: 'reta-final',
      titulo: 'Reta final',
      texto: `Oi, ${nome}! Você já está em ${Math.round(ctx.progresso)}% de ${curso} — falta pouco para concluir e emitir o certificado. Quer que eu te ajude a fechar essa reta final?`,
    });
  }

  modelos.push(
    {
      chave: 'acompanhamento',
      titulo: 'Acompanhamento',
      texto: `Oi, ${nome}! Aqui é da ${escola}. Passando para saber como está indo em ${curso}. Está conseguindo acompanhar? Alguma dúvida que eu possa ajudar?`,
    },
    {
      chave: 'mentoria',
      titulo: 'Convite para mentoria',
      texto: `Oi, ${nome}! Temos mentoria ao vivo para tirar dúvidas de ${curso}. Quer que eu te mande o link e o horário da próxima?`,
    },
    {
      chave: 'financeiro',
      titulo: 'Pagamento pendente',
      texto: `Oi, ${nome}! Tudo bem? Identifiquei uma pendência no seu pagamento aqui na ${escola}. Se precisar de uma segunda via ou quiser combinar outra data, me avisa que eu resolvo por aqui.`,
    },
    {
      chave: 'pesquisa',
      titulo: 'Pedir avaliação',
      texto: `Oi, ${nome}! Uma perguntinha rápida: de 0 a 10, quanto você recomendaria a ${escola} para um amigo? Sua resposta ajuda muito a gente a melhorar.`,
    },
    {
      chave: 'livre',
      titulo: 'Conversa livre',
      texto: `Oi, ${nome}! Aqui é da ${escola}. Tudo bem?`,
    },
  );

  return modelos;
}
