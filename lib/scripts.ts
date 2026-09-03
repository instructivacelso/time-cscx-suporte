/**
 * Constantes e regras dos scripts de mensagem.
 *
 * Fica em `lib` (e não em `server`) porque a tela de edição é um componente de
 * cliente e precisa dos mesmos rótulos e variáveis — sem arrastar o banco junto.
 */
export const CANAIS = ['WHATSAPP', 'EMAIL', 'TELEFONE', 'PLATAFORMA'] as const;
export type CanalScript = (typeof CANAIS)[number];

export const SITUACOES = [
  'BOAS_VINDAS',
  'PRIMEIRO_ACESSO',
  'RESGATE',
  'ACOMPANHAMENTO',
  'RETA_FINAL',
  'MENTORIA',
  'FINANCEIRO',
  'PESQUISA',
  'CERTIFICADO',
  'GERAL',
] as const;
export type SituacaoScript = (typeof SITUACOES)[number];

export const CANAL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  TELEFONE: 'Telefone',
  PLATAFORMA: 'Plataforma',
};

export const SITUACAO_LABELS: Record<string, string> = {
  BOAS_VINDAS: 'Boas-vindas',
  PRIMEIRO_ACESSO: 'Primeiro acesso',
  RESGATE: 'Resgate — aluno parado',
  ACOMPANHAMENTO: 'Acompanhamento',
  RETA_FINAL: 'Reta final',
  MENTORIA: 'Mentoria',
  FINANCEIRO: 'Financeiro',
  PESQUISA: 'Pesquisa (NPS/CSAT)',
  CERTIFICADO: 'Certificado',
  GERAL: 'Geral',
};

/**
 * Variáveis que o sistema troca pelo dado real na hora de usar o script.
 * O que estiver entre chaves duplas é substituído; o resto é enviado como está.
 */
export const VARIAVEIS: { chave: string; descricao: string }[] = [
  { chave: '{{nome}}', descricao: 'Primeiro nome do aluno' },
  { chave: '{{nome_completo}}', descricao: 'Nome completo do aluno' },
  { chave: '{{curso}}', descricao: 'Curso ou entrega mais recente' },
  { chave: '{{progresso}}', descricao: 'Percentual concluído' },
  { chave: '{{dias_sem_acesso}}', descricao: 'Dias desde o último acesso' },
  { chave: '{{escola}}', descricao: 'Nome da escola' },
  { chave: '{{link}}', descricao: 'Link do ambiente do aluno' },
  { chave: '{{analista}}', descricao: 'Nome de quem está atendendo' },
];

export interface ContextoScript {
  nome: string;
  curso: string | null;
  progresso: number;
  diasSemAcesso: number;
  escola?: string;
  link?: string | null;
  analista?: string;
}

/** Substitui as variáveis pelo dado real. O que não existir vira texto vazio. */
export function aplicarVariaveis(texto: string, ctx: ContextoScript) {
  const valores: Record<string, string> = {
    nome: ctx.nome.trim().split(/\s+/)[0] ?? ctx.nome,
    nome_completo: ctx.nome,
    curso: ctx.curso ?? 'seu curso',
    progresso: `${Math.round(ctx.progresso)}%`,
    dias_sem_acesso: String(ctx.diasSemAcesso),
    escola: ctx.escola ?? 'Escola Instructiva',
    link: ctx.link ?? '',
    analista: ctx.analista ?? '',
  };

  return texto
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, chave: string) => valores[chave] ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

