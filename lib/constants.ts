import type { HealthBand, JourneyStage, Role } from '@/db/schema';

export const APP_NAME = 'CSCX';
export const APP_LONG_NAME = 'Customer Success & Customer Experience';
export const ORG_NAME = 'Escola Instructiva';

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  COORDENADOR: 'Coordenador CSCX',
  ANALISTA: 'Analista CSCX',
  ALUNO: 'Aluno',
};

export const JOURNEY_STAGES: JourneyStage[] = [
  'NOVO',
  'ONBOARDING',
  'PRIMEIRO_ACESSO',
  'ATIVACAO',
  'ENGAJAMENTO',
  'EM_ACOMPANHAMENTO',
  'CONCLUINDO',
  'CERTIFICADO',
  'POS_CURSO',
  'EXPANSAO',
  'EMBAIXADOR',
];

export const STAGE_LABELS: Record<JourneyStage, string> = {
  NOVO: 'Novo',
  ONBOARDING: 'Onboarding',
  PRIMEIRO_ACESSO: 'Primeiro acesso',
  ATIVACAO: 'Ativação',
  ENGAJAMENTO: 'Engajamento',
  EM_ACOMPANHAMENTO: 'Em acompanhamento',
  CONCLUINDO: 'Concluindo',
  CERTIFICADO: 'Certificado',
  POS_CURSO: 'Pós-curso',
  EXPANSAO: 'Expansão',
  EMBAIXADOR: 'Embaixador',
};

export const STAGE_DESCRIPTIONS: Record<JourneyStage, string> = {
  NOVO: 'Matrícula registrada, aluno ainda não iniciou o onboarding.',
  ONBOARDING: 'Boas-vindas enviadas e checklist de entrada em andamento.',
  PRIMEIRO_ACESSO: 'Aluno acessou a plataforma pela primeira vez.',
  ATIVACAO: 'Concluiu a primeira aula e configurou o cronograma.',
  ENGAJAMENTO: 'Estuda com regularidade e participa das atividades.',
  EM_ACOMPANHAMENTO: 'Rotina estabelecida — acompanhamento periódico do CS.',
  CONCLUINDO: 'Acima de 80% do curso — reta final.',
  CERTIFICADO: 'Curso concluído e certificado emitido.',
  POS_CURSO: 'Relacionamento pós-conclusão e coleta de resultados.',
  EXPANSAO: 'Elegível para novos cursos e upgrades.',
  EMBAIXADOR: 'Promotor ativo que indica a escola.',
};

/** Checklist padrão de cada etapa da jornada. */
export const STAGE_CHECKLISTS: Record<JourneyStage, string[]> = {
  NOVO: [
    'Cadastro validado (nome, e-mail e WhatsApp)',
    'Matrícula confirmada no LMS',
    'Analista CSCX responsável definido',
    'Pagamento de entrada confirmado',
  ],
  ONBOARDING: [
    'Mensagem de boas-vindas enviada',
    'E-mail de boas-vindas entregue',
    'WhatsApp de boas-vindas entregue',
    'Vídeo institucional assistido',
    'Tutorial da plataforma concluído',
  ],
  PRIMEIRO_ACESSO: [
    'Login realizado',
    'Perfil atualizado com foto e dados',
    'Termo de uso aceito',
    'Notificações habilitadas',
  ],
  ATIVACAO: [
    'Primeira aula concluída',
    'Cronograma de estudos definido',
    'Meta semanal registrada',
    'Mentor apresentado',
  ],
  ENGAJAMENTO: [
    'Entrou na comunidade',
    'Participou da primeira mentoria',
    'Concluiu a primeira avaliação',
    'Sequência de 2 semanas de estudo',
  ],
  EM_ACOMPANHAMENTO: [
    'Check-in mensal realizado',
    'Health Score revisado',
    'Pesquisa NPS respondida',
    'Plano de estudo reajustado',
  ],
  CONCLUINDO: [
    'Progresso acima de 80%',
    'Pendências de avaliação zeradas',
    'Projeto final entregue',
    'Contato de reta final feito',
  ],
  CERTIFICADO: [
    'Certificado emitido',
    'Mensagem de parabéns enviada',
    'Depoimento solicitado',
    'Pesquisa de conclusão respondida',
  ],
  POS_CURSO: [
    'Case de resultado coletado',
    'Aluno adicionado ao grupo de egressos',
    'Convite para eventos enviado',
  ],
  EXPANSAO: [
    'Oferta de novo curso apresentada',
    'Condição especial de egresso enviada',
    'Interesse mapeado',
  ],
  EMBAIXADOR: [
    'Programa de indicação apresentado',
    'Link de indicação entregue',
    'Primeira indicação registrada',
  ],
};

export const HEALTH_BAND_LABELS: Record<HealthBand, string> = {
  EXCELENTE: 'Excelente',
  SAUDAVEL: 'Saudável',
  ATENCAO: 'Atenção',
  RISCO: 'Risco',
  CRITICO: 'Crítico',
};

export const HEALTH_BAND_EMOJI: Record<HealthBand, string> = {
  EXCELENTE: '🟢',
  SAUDAVEL: '🟢',
  ATENCAO: '🟡',
  RISCO: '🟠',
  CRITICO: '🔴',
};

/** Variáveis CSS das faixas — trocam sozinhas entre tema claro e escuro. */
export const HEALTH_BAND_VAR: Record<HealthBand, string> = {
  EXCELENTE: '--health-excellent',
  SAUDAVEL: '--health-healthy',
  ATENCAO: '--health-attention',
  RISCO: '--health-risk',
  CRITICO: '--health-critical',
};

/** Fallback estático (usado onde não há CSS disponível, como exportações). */
export const HEALTH_BAND_COLORS: Record<HealthBand, string> = {
  EXCELENTE: '#0d9460',
  SAUDAVEL: '#22a560',
  ATENCAO: '#d99800',
  RISCO: '#e27418',
  CRITICO: '#d8332f',
};

export const ONBOARDING_CHECKLIST = [
  { key: 'acesso', label: 'Acesso realizado', order: 1 },
  { key: 'perfil', label: 'Perfil atualizado', order: 2 },
  { key: 'primeira_aula', label: 'Primeira aula assistida', order: 3 },
  { key: 'comunidade', label: 'Entrou na comunidade', order: 4 },
  { key: 'cronograma', label: 'Cronograma definido', order: 5 },
  { key: 'mentor', label: 'Mentor apresentado', order: 6 },
] as const;

export const ALERT_TYPE_LABELS: Record<string, string> = {
  SEM_ACESSO_7D: '7 dias sem acessar',
  CRONOGRAMA_ATRASADO: 'Cronograma atrasado',
  QUEDA_HEALTH_SCORE: 'Queda no Health Score',
  NPS_BAIXO: 'NPS baixo',
  CSAT_BAIXO: 'CSAT baixo',
  PAGAMENTO_ATRASADO: 'Pagamento atrasado',
  BAIXO_ENGAJAMENTO: 'Baixo engajamento',
  POUCA_PARTICIPACAO: 'Pouca participação',
  RECLAMACAO_RECORRENTE: 'Reclamações recorrentes',
  RISCO_EVASAO: 'Risco de evasão',
};

export const AUTOMATION_TRIGGER_LABELS: Record<string, string> = {
  NOVO_ALUNO: 'Novo aluno',
  ALUNO_PARADO: 'Aluno parado',
  ALUNO_CONCLUINDO: 'Aluno concluindo',
  ALUNO_CERTIFICADO: 'Aluno certificado',
  ALUNO_EM_RISCO: 'Aluno em risco',
  ALUNO_PROMOTOR: 'Aluno promotor',
  PAGAMENTO_CONFIRMADO: 'Pagamento confirmado',
  PAGAMENTO_PENDENTE: 'Pagamento pendente',
  PESQUISA_NPS: 'Pesquisa NPS',
  PESQUISA_CSAT: 'Pesquisa CSAT',
  PARABENS_CONCLUSAO: 'Parabéns por conclusão',
  OFERTA_NOVOS_CURSOS: 'Oferta de novos cursos',
};

export const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  TELEFONE: 'Telefone',
  PRESENCIAL: 'Presencial',
  PLATAFORMA: 'Plataforma',
  MENTORIA: 'Mentoria',
  COMUNIDADE: 'Comunidade',
  TAREFA_INTERNA: 'Tarefa interna',
  WEBHOOK: 'Webhook',
  OUTRO: 'Outro',
};

export const INTEGRATION_CATALOG: {
  kind: string;
  name: string;
  category: string;
  description: string;
  envKeys: string[];
}[] = [
  {
    kind: 'GOOGLE_WORKSPACE',
    name: 'Google Workspace',
    category: 'Produtividade',
    description: 'Agenda de mentorias, Meet e Drive de materiais.',
    envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
  {
    kind: 'WHATSAPP_BUSINESS',
    name: 'WhatsApp Business API',
    category: 'Comunicação',
    description: 'Disparo de mensagens de onboarding, alertas e pesquisas.',
    envKeys: ['WHATSAPP_PHONE_ID', 'WHATSAPP_TOKEN'],
  },
  {
    kind: 'SMTP',
    name: 'E-mail (SMTP)',
    category: 'Comunicação',
    description: 'Envio transacional de e-mails da régua de relacionamento.',
    envKeys: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'],
  },
  {
    kind: 'LMS',
    name: 'LMS Escola Instructiva',
    category: 'Acadêmico',
    description: 'Progresso, aulas assistidas, notas e certificados.',
    envKeys: ['LMS_BASE_URL', 'LMS_API_KEY'],
  },
  {
    kind: 'CRM',
    name: 'CRM comercial',
    category: 'Vendas',
    description: 'Origem do lead, histórico comercial e oportunidades de expansão.',
    envKeys: ['CRM_BASE_URL', 'CRM_API_KEY'],
  },
  {
    kind: 'STRIPE',
    name: 'Stripe',
    category: 'Financeiro',
    description: 'Assinaturas internacionais e status de cobrança.',
    envKeys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  },
  {
    kind: 'MERCADO_PAGO',
    name: 'Mercado Pago',
    category: 'Financeiro',
    description: 'Pagamentos e conciliação de parcelas.',
    envKeys: ['MERCADOPAGO_ACCESS_TOKEN'],
  },
  {
    kind: 'ASAAS',
    name: 'Asaas',
    category: 'Financeiro',
    description: 'Boletos, Pix e régua de cobrança.',
    envKeys: ['ASAAS_API_KEY'],
  },
  {
    kind: 'RD_STATION',
    name: 'RD Station',
    category: 'Marketing',
    description: 'Sincronização de leads, tags e eventos de conversão.',
    envKeys: ['RDSTATION_CLIENT_ID', 'RDSTATION_CLIENT_SECRET'],
  },
  {
    kind: 'META_ADS',
    name: 'Meta Ads',
    category: 'Marketing',
    description: 'Custo de aquisição por aluno e públicos de retenção.',
    envKeys: ['META_ADS_TOKEN', 'META_AD_ACCOUNT_ID'],
  },
  {
    kind: 'GOOGLE_ANALYTICS',
    name: 'Google Analytics',
    category: 'Marketing',
    description: 'Comportamento no site e atribuição de origem.',
    envKeys: ['GA_PROPERTY_ID', 'GA_CREDENTIALS_JSON'],
  },
  {
    kind: 'POWER_BI',
    name: 'Power BI',
    category: 'BI',
    description: 'Endpoint de dataset para os painéis da diretoria.',
    envKeys: ['POWERBI_PUSH_URL'],
  },
];
