/**
 * CSCX — Customer Success & Customer Experience
 * Escola Instructiva
 *
 * Modelo de dados relacional (PostgreSQL / Drizzle ORM).
 */
import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  jsonb,
  numeric,
  uniqueIndex,
  index,
  date,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ───────────────────────────── ENUMS ─────────────────────────────

export const roleEnum = pgEnum('role', ['ADMIN', 'COORDENADOR', 'ANALISTA', 'ALUNO']);

export const journeyStageEnum = pgEnum('journey_stage', [
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
]);

export const healthBandEnum = pgEnum('health_band', [
  'EXCELENTE',
  'SAUDAVEL',
  'ATENCAO',
  'RISCO',
  'CRITICO',
]);

export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'ATIVA',
  'PAUSADA',
  'CONCLUIDA',
  'CANCELADA',
  'INADIMPLENTE',
]);

export const surveyTypeEnum = pgEnum('survey_type', ['NPS', 'CSAT']);

export const surveyTriggerEnum = pgEnum('survey_trigger', [
  'ONBOARDING',
  'ATENDIMENTO',
  'MENTORIA',
  'CONCLUSAO',
  'D30',
  'D60',
  'D90',
  'MANUAL',
]);

export const surveyStatusEnum = pgEnum('survey_status', [
  'PENDENTE',
  'ENVIADA',
  'RESPONDIDA',
  'EXPIRADA',
]);

export const npsClassEnum = pgEnum('nps_class', ['PROMOTOR', 'NEUTRO', 'DETRATOR']);

export const alertTypeEnum = pgEnum('alert_type', [
  'SEM_ACESSO_7D',
  'CRONOGRAMA_ATRASADO',
  'QUEDA_HEALTH_SCORE',
  'NPS_BAIXO',
  'CSAT_BAIXO',
  'PAGAMENTO_ATRASADO',
  'BAIXO_ENGAJAMENTO',
  'POUCA_PARTICIPACAO',
  'RECLAMACAO_RECORRENTE',
  'RISCO_EVASAO',
]);

export const alertSeverityEnum = pgEnum('alert_severity', ['INFO', 'ATENCAO', 'ALTA', 'CRITICA']);

export const alertStatusEnum = pgEnum('alert_status', [
  'ABERTO',
  'EM_TRATATIVA',
  'RESOLVIDO',
  'IGNORADO',
]);

export const interactionChannelEnum = pgEnum('interaction_channel', [
  'WHATSAPP',
  'EMAIL',
  'TELEFONE',
  'PRESENCIAL',
  'PLATAFORMA',
  'MENTORIA',
  'COMUNIDADE',
  'OUTRO',
]);

export const interactionDirectionEnum = pgEnum('interaction_direction', ['ENTRADA', 'SAIDA']);

export const taskStatusEnum = pgEnum('task_status', [
  'ABERTA',
  'EM_ANDAMENTO',
  'CONCLUIDA',
  'CANCELADA',
]);

export const taskPriorityEnum = pgEnum('task_priority', ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']);

export const actionPlanStatusEnum = pgEnum('action_plan_status', [
  'ABERTO',
  'EM_EXECUCAO',
  'CONCLUIDO',
  'SEM_SUCESSO',
  'CANCELADO',
]);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'ABERTO',
  'EM_ANDAMENTO',
  'AGUARDANDO_ALUNO',
  'RESOLVIDO',
  'FECHADO',
]);

export const automationTriggerEnum = pgEnum('automation_trigger', [
  'NOVO_ALUNO',
  'ALUNO_PARADO',
  'ALUNO_CONCLUINDO',
  'ALUNO_CERTIFICADO',
  'ALUNO_EM_RISCO',
  'ALUNO_PROMOTOR',
  'PAGAMENTO_CONFIRMADO',
  'PAGAMENTO_PENDENTE',
  'PESQUISA_NPS',
  'PESQUISA_CSAT',
  'PARABENS_CONCLUSAO',
  'OFERTA_NOVOS_CURSOS',
]);

export const automationChannelEnum = pgEnum('automation_channel', [
  'EMAIL',
  'WHATSAPP',
  'PLATAFORMA',
  'TAREFA_INTERNA',
  'WEBHOOK',
]);

export const runStatusEnum = pgEnum('run_status', [
  'AGENDADO',
  'ENVIADO',
  'FALHOU',
  'CANCELADO',
  'SIMULADO',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'EM_DIA',
  'PENDENTE',
  'ATRASADO',
  'INADIMPLENTE',
  'ISENTO',
]);

export const integrationKindEnum = pgEnum('integration_kind', [
  'GOOGLE_WORKSPACE',
  'WHATSAPP_BUSINESS',
  'SMTP',
  'LMS',
  'CRM',
  'STRIPE',
  'MERCADO_PAGO',
  'ASAAS',
  'RD_STATION',
  'META_ADS',
  'GOOGLE_ANALYTICS',
  'POWER_BI',
]);

export const integrationStatusEnum = pgEnum('integration_status', [
  'NAO_CONFIGURADA',
  'CONFIGURADA',
  'CONECTADA',
  'ERRO',
]);

// ───────────────────────── HELPERS ─────────────────────────

const id = () =>
  text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()::text`);

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();

// ───────────────────────── USUÁRIOS ─────────────────────────

export const users = pgTable(
  'users',
  {
    id: id(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').default('ANALISTA').notNull(),
    avatarColor: varchar('avatar_color', { length: 16 }).default('#3366ff').notNull(),
    phone: text('phone'),
    active: boolean('active').default(true).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    roleIdx: index('users_role_idx').on(t.role),
  }),
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata'),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => ({
    entityIdx: index('audit_entity_idx').on(t.entity, t.entityId),
    createdIdx: index('audit_created_idx').on(t.createdAt),
  }),
);

// ───────────────────────── CATÁLOGO ─────────────────────────

export const courses = pgTable(
  'courses',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    category: text('category').default('Treinamento').notNull(),
    description: text('description'),
    workloadHours: integer('workload_hours').default(40).notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).default('0').notNull(),
    active: boolean('active').default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ slugIdx: uniqueIndex('courses_slug_idx').on(t.slug) }),
);

export const tracks = pgTable(
  'tracks',
  {
    id: id(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    order: integer('order').default(0).notNull(),
  },
  (t) => ({ courseIdx: index('tracks_course_idx').on(t.courseId) }),
);

export const modules = pgTable(
  'modules',
  {
    id: id(),
    trackId: text('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    order: integer('order').default(0).notNull(),
    lessons: integer('lessons').default(1).notNull(),
  },
  (t) => ({ trackIdx: index('modules_track_idx').on(t.trackId) }),
);

export const classGroups = pgTable(
  'class_groups',
  {
    id: id(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({ courseIdx: index('class_groups_course_idx').on(t.courseId) }),
);

// ───────────────────────── ALUNO ─────────────────────────

export const students = pgTable(
  'students',
  {
    id: id(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    city: text('city'),
    state: varchar('state', { length: 2 }),
    photoUrl: text('photo_url'),
    origin: text('origin'),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
    stage: journeyStageEnum('stage').default('NOVO').notNull(),
    stageChangedAt: timestamp('stage_changed_at', { withTimezone: true }).defaultNow().notNull(),

    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
    mentorId: text('mentor_id').references(() => users.id, { onDelete: 'set null' }),

    healthScore: integer('health_score').default(50).notNull(),
    healthBand: healthBandEnum('health_band').default('ATENCAO').notNull(),
    healthUpdatedAt: timestamp('health_updated_at', { withTimezone: true }).defaultNow().notNull(),
    previousHealth: integer('previous_health'),
    churnRisk: integer('churn_risk').default(0).notNull(),
    lastAccessAt: timestamp('last_access_at', { withTimezone: true }),
    daysWithoutAccess: integer('days_without_access').default(0).notNull(),
    studiedHours: doublePrecision('studied_hours').default(0).notNull(),
    progressPercent: doublePrecision('progress_percent').default(0).notNull(),
    onboardingPercent: doublePrecision('onboarding_percent').default(0).notNull(),
    npsLast: integer('nps_last'),
    csatLast: doublePrecision('csat_last'),
    paymentStatus: paymentStatusEnum('payment_status').default('EM_DIA').notNull(),
    mrr: numeric('mrr', { precision: 10, scale: 2 }).default('0').notNull(),
    ltv: numeric('ltv', { precision: 10, scale: 2 }).default('0').notNull(),
    weeklyGoalHours: doublePrecision('weekly_goal_hours').default(4).notNull(),
    monthlyGoalHours: doublePrecision('monthly_goal_hours').default(16).notNull(),
    notes: text('notes'),
    tags: text('tags').array().default(sql`ARRAY[]::text[]`).notNull(),

    active: boolean('active').default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    codeIdx: uniqueIndex('students_code_idx').on(t.code),
    emailIdx: uniqueIndex('students_email_idx').on(t.email),
    stageIdx: index('students_stage_idx').on(t.stage),
    bandIdx: index('students_band_idx').on(t.healthBand),
    ownerIdx: index('students_owner_idx').on(t.ownerId),
  }),
);

export const enrollments = pgTable(
  'enrollments',
  {
    id: id(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    classGroupId: text('class_group_id').references(() => classGroups.id, { onDelete: 'set null' }),
    status: enrollmentStatusEnum('status').default('ATIVA').notNull(),
    progressPercent: doublePrecision('progress_percent').default(0).notNull(),
    currentModule: text('current_module'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    expectedFinishAt: timestamp('expected_finish_at', { withTimezone: true }),
    certificateIssuedAt: timestamp('certificate_issued_at', { withTimezone: true }),
    gradeAverage: doublePrecision('grade_average'),
    activitiesDone: integer('activities_done').default(0).notNull(),
    activitiesTotal: integer('activities_total').default(0).notNull(),
    value: numeric('value', { precision: 10, scale: 2 }).default('0').notNull(),
  },
  (t) => ({
    uq: uniqueIndex('enrollments_student_course_idx').on(t.studentId, t.courseId),
    statusIdx: index('enrollments_status_idx').on(t.status),
  }),
);

export const journeyEvents = pgTable(
  'journey_events',
  {
    id: id(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    stage: journeyStageEnum('stage').notNull(),
    fromStage: journeyStageEnum('from_stage'),
    note: text('note'),
    automatic: boolean('automatic').default(true).notNull(),
    createdAt: createdAt(),
  },
  (t) => ({ idx: index('journey_student_idx').on(t.studentId, t.createdAt) }),
);

export const onboardingItems = pgTable(
  'onboarding_items',
  {
    id: id(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    order: integer('order').default(0).notNull(),
    done: boolean('done').default(false).notNull(),
    doneAt: timestamp('done_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({ uq: uniqueIndex('onboarding_student_key_idx').on(t.studentId, t.key) }),
);

export const studyActivities = pgTable(
  'study_activities',
  {
    id: id(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    date: timestamp('date', { withTimezone: true }).notNull(),
    minutes: integer('minutes').default(0).notNull(),
    lessonsDone: integer('lessons_done').default(0).notNull(),
    quizzesDone: integer('quizzes_done').default(0).notNull(),
    score: doublePrecision('score'),
    communityPosts: integer('community_posts').default(0).notNull(),
    source: text('source').default('LMS').notNull(),
  },
  (t) => ({ idx: index('study_student_date_idx').on(t.studentId, t.date) }),
);

export const mentorshipAttendances = pgTable(
  'mentorship_attendances',
  {
    id: id(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    attended: boolean('attended').default(false).notNull(),
    minutes: integer('minutes').default(0).notNull(),
  },
  (t) => ({ idx: index('mentorship_student_idx').on(t.studentId, t.date) }),
);

// ───────────────────────── HEALTH SCORE ─────────────────────────

export const healthScoreConfig = pgTable('health_score_config', {
  id: text('id').primaryKey().default('default'),
  weights: jsonb('weights').notNull(),
  thresholds: jsonb('thresholds').notNull(),
  updatedAt: updatedAt(),
});

export const healthSnapshots = pgTable(
  'health_snapshots',
  {
    id: id(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    score: integer('score').notNull(),
    band: healthBandEnum('band').notNull(),
    breakdown: jsonb('breakdown').notNull(),
    churnRisk: integer('churn_risk').default(0).notNull(),
    createdAt: createdAt(),
  },
  (t) => ({ idx: index('health_student_created_idx').on(t.studentId, t.createdAt) }),
);

// ───────────────────────── PESQUISAS ─────────────────────────

export const surveyResponses = pgTable(
  'survey_responses',
  {
    id: id(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    type: surveyTypeEnum('type').notNull(),
    trigger: surveyTriggerEnum('trigger').default('MANUAL').notNull(),
    status: surveyStatusEnum('status').default('PENDENTE').notNull(),
    score: integer('score'),
    npsClass: npsClassEnum('nps_class'),
    comment: text('comment'),
    contextRef: text('context_ref'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({
    typeIdx: index('survey_type_status_idx').on(t.type, t.status),
    studentIdx: index('survey_student_idx').on(t.studentId, t.createdAt),
  }),
);

// ───────────────────────── CRM / OPERAÇÃO ─────────────────────────

export const alerts = pgTable(
  'alerts',
  {
    id: id(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    type: alertTypeEnum('type').notNull(),
    severity: alertSeverityEnum('severity').default('ATENCAO').notNull(),
    status: alertStatusEnum('status').default('ABERTO').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    metadata: jsonb('metadata'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    statusIdx: index('alerts_status_idx').on(t.status, t.severity),
    studentIdx: index('alerts_student_idx').on(t.studentId),
  }),
);

export const interactions = pgTable(
  'interactions',
  {
    id: id(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    channel: interactionChannelEnum('channel').notNull(),
    direction: interactionDirectionEnum('direction').default('SAIDA').notNull(),
    subject: text('subject').notNull(),
    content: text('content').notNull(),
    responseMinutes: integer('response_minutes'),
    createdAt: createdAt(),
  },
  (t) => ({ idx: index('interactions_student_idx').on(t.studentId, t.createdAt) }),
);

export const actionPlans = pgTable(
  'action_plans',
  {
    id: id(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    reason: text('reason').notNull(),
    strategy: text('strategy').notNull(),
    status: actionPlanStatusEnum('status').default('ABERTO').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    outcome: text('outcome'),
    generatedByAi: boolean('generated_by_ai').default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    statusIdx: index('action_plans_status_idx').on(t.status),
    studentIdx: index('action_plans_student_idx').on(t.studentId),
  }),
);

export const tasks = pgTable(
  'tasks',
  {
    id: id(),
    studentId: text('student_id').references(() => students.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
    createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    actionPlanId: text('action_plan_id').references(() => actionPlans.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: taskStatusEnum('status').default('ABERTA').notNull(),
    priority: taskPriorityEnum('priority').default('MEDIA').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    statusIdx: index('tasks_status_due_idx').on(t.status, t.dueAt),
    ownerIdx: index('tasks_owner_idx').on(t.ownerId),
  }),
);

export const tickets = pgTable(
  'tickets',
  {
    id: id(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
    subject: text('subject').notNull(),
    category: text('category').default('Suporte').notNull(),
    body: text('body').notNull(),
    status: ticketStatusEnum('status').default('ABERTO').notNull(),
    firstResponseMinutes: integer('first_response_minutes'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    statusIdx: index('tickets_status_idx').on(t.status),
    studentIdx: index('tickets_student_idx').on(t.studentId),
  }),
);

// ───────────────────────── PLAYBOOKS / AUTOMAÇÕES ─────────────────────────

export const playbooks = pgTable('playbooks', {
  id: id(),
  name: text('name').notNull(),
  trigger: text('trigger').notNull(),
  description: text('description').notNull(),
  steps: jsonb('steps').notNull(),
  active: boolean('active').default(true).notNull(),
  createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const automations = pgTable(
  'automations',
  {
    id: id(),
    name: text('name').notNull(),
    trigger: automationTriggerEnum('trigger').notNull(),
    channel: automationChannelEnum('channel').notNull(),
    description: text('description').notNull(),
    template: text('template').notNull(),
    delayHours: integer('delay_hours').default(0).notNull(),
    active: boolean('active').default(true).notNull(),
    conditions: jsonb('conditions'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ idx: index('automations_trigger_idx').on(t.trigger, t.active) }),
);

export const automationRuns = pgTable(
  'automation_runs',
  {
    id: id(),
    automationId: text('automation_id')
      .notNull()
      .references(() => automations.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    status: runStatusEnum('status').default('SIMULADO').notNull(),
    payload: jsonb('payload'),
    error: text('error'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({
    autoIdx: index('runs_automation_idx').on(t.automationId, t.createdAt),
    studentIdx: index('runs_student_idx').on(t.studentId),
  }),
);

// ───────────────────────── FINANCEIRO / INTEGRAÇÕES ─────────────────────────

export const payments = pgTable(
  'payments',
  {
    id: id(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    reference: text('reference').notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    status: paymentStatusEnum('status').default('PENDENTE').notNull(),
    gateway: text('gateway').default('manual').notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    studentIdx: index('payments_student_idx').on(t.studentId, t.dueAt),
    statusIdx: index('payments_status_idx').on(t.status),
  }),
);

export const integrations = pgTable(
  'integrations',
  {
    id: id(),
    kind: integrationKindEnum('kind').notNull(),
    name: text('name').notNull(),
    status: integrationStatusEnum('status').default('NAO_CONFIGURADA').notNull(),
    config: jsonb('config'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    notes: text('notes'),
    updatedAt: updatedAt(),
  },
  (t) => ({ kindIdx: uniqueIndex('integrations_kind_idx').on(t.kind) }),
);

// ───────────────────────── ASSISTENTE IA ─────────────────────────

export const assistantThreads = pgTable(
  'assistant_threads',
  {
    id: id(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    studentId: text('student_id').references(() => students.id, { onDelete: 'cascade' }),
    title: text('title').default('Nova conversa').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ idx: index('threads_user_idx').on(t.userId, t.updatedAt) }),
);

export const assistantMessages = pgTable(
  'assistant_messages',
  {
    id: id(),
    threadId: text('thread_id')
      .notNull()
      .references(() => assistantThreads.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    tokens: integer('tokens'),
    createdAt: createdAt(),
  },
  (t) => ({ idx: index('messages_thread_idx').on(t.threadId, t.createdAt) }),
);

export const metricSnapshots = pgTable(
  'metric_snapshots',
  {
    id: id(),
    date: date('date').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: createdAt(),
  },
  (t) => ({ dateIdx: uniqueIndex('metric_date_idx').on(t.date) }),
);

/**
 * Registro bruto de tudo que chega pelos webhooks (Cademí, gateways…).
 * Guardar o corpo original permite conferir o formato real que a plataforma
 * envia, reprocessar o que falhou e auditar de onde veio cada aluno.
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: id(),
    source: text('source').notNull(),
    eventType: text('event_type'),
    email: text('email'),
    studentId: text('student_id').references(() => students.id, { onDelete: 'set null' }),
    status: text('status').default('RECEBIDO').notNull(),
    message: text('message'),
    payload: jsonb('payload').notNull(),
    receivedAt: createdAt(),
  },
  (t) => ({
    sourceIdx: index('webhook_source_idx').on(t.source),
    receivedIdx: index('webhook_received_idx').on(t.receivedAt),
  }),
);

// ───────────────────────── RELATIONS ─────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  ownedStudents: many(students, { relationName: 'owner' }),
  interactions: many(interactions),
  tasks: many(tasks),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  owner: one(users, { fields: [students.ownerId], references: [users.id], relationName: 'owner' }),
  mentor: one(users, { fields: [students.mentorId], references: [users.id], relationName: 'mentor' }),
  user: one(users, { fields: [students.userId], references: [users.id], relationName: 'account' }),
  enrollments: many(enrollments),
  onboardingItems: many(onboardingItems),
  journeyEvents: many(journeyEvents),
  activities: many(studyActivities),
  healthSnapshots: many(healthSnapshots),
  surveys: many(surveyResponses),
  alerts: many(alerts),
  interactions: many(interactions),
  tasks: many(tasks),
  actionPlans: many(actionPlans),
  tickets: many(tickets),
  payments: many(payments),
  mentorships: many(mentorshipAttendances),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(students, { fields: [enrollments.studentId], references: [students.id] }),
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] }),
  classGroup: one(classGroups, { fields: [enrollments.classGroupId], references: [classGroups.id] }),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  tracks: many(tracks),
  classGroups: many(classGroups),
  enrollments: many(enrollments),
}));

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  course: one(courses, { fields: [tracks.courseId], references: [courses.id] }),
  modules: many(modules),
}));

export const modulesRelations = relations(modules, ({ one }) => ({
  track: one(tracks, { fields: [modules.trackId], references: [tracks.id] }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  student: one(students, { fields: [alerts.studentId], references: [students.id] }),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  student: one(students, { fields: [interactions.studentId], references: [students.id] }),
  user: one(users, { fields: [interactions.userId], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  student: one(students, { fields: [tasks.studentId], references: [students.id] }),
  owner: one(users, { fields: [tasks.ownerId], references: [users.id] }),
  actionPlan: one(actionPlans, { fields: [tasks.actionPlanId], references: [actionPlans.id] }),
}));

export const actionPlansRelations = relations(actionPlans, ({ one, many }) => ({
  student: one(students, { fields: [actionPlans.studentId], references: [students.id] }),
  owner: one(users, { fields: [actionPlans.ownerId], references: [users.id] }),
  tasks: many(tasks),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  student: one(students, { fields: [tickets.studentId], references: [students.id] }),
  owner: one(users, { fields: [tickets.ownerId], references: [users.id] }),
}));

export const surveyResponsesRelations = relations(surveyResponses, ({ one }) => ({
  student: one(students, { fields: [surveyResponses.studentId], references: [students.id] }),
}));

export const automationRunsRelations = relations(automationRuns, ({ one }) => ({
  automation: one(automations, { fields: [automationRuns.automationId], references: [automations.id] }),
  student: one(students, { fields: [automationRuns.studentId], references: [students.id] }),
}));

export const automationsRelations = relations(automations, ({ many }) => ({
  runs: many(automationRuns),
}));

export const assistantThreadsRelations = relations(assistantThreads, ({ one, many }) => ({
  user: one(users, { fields: [assistantThreads.userId], references: [users.id] }),
  student: one(students, { fields: [assistantThreads.studentId], references: [students.id] }),
  messages: many(assistantMessages),
}));

export const assistantMessagesRelations = relations(assistantMessages, ({ one }) => ({
  thread: one(assistantThreads, { fields: [assistantMessages.threadId], references: [assistantThreads.id] }),
}));

// ───────────────────────── TYPES ─────────────────────────

export type User = typeof users.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type Interaction = typeof interactions.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ActionPlan = typeof actionPlans.$inferSelect;
export type Automation = typeof automations.$inferSelect;
export type HealthSnapshot = typeof healthSnapshots.$inferSelect;
export type StudyActivity = typeof studyActivities.$inferSelect;
export type OnboardingItem = typeof onboardingItems.$inferSelect;
export type JourneyEvent = typeof journeyEvents.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type Playbook = typeof playbooks.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type JourneyStage = (typeof journeyStageEnum.enumValues)[number];
export type HealthBand = (typeof healthBandEnum.enumValues)[number];
