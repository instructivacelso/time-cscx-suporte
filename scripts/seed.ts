/**
 * Seed de demonstração do CSCX — Escola Instructiva.
 *
 *   npm run db:seed          # popula (mantendo o que já existe)
 *   npm run db:reset         # limpa tudo e popula de novo
 *
 * Gera uma base realista: equipe, cursos, turmas, alunos em todas as etapas
 * da jornada, histórico de estudos de 90 dias, pesquisas, mentorias, cobranças,
 * tickets e interações. Ao final roda a rotina diária completa, que calcula
 * Health Score, alertas, planos de ação e automações.
 */
import 'dotenv/config';
import { hash } from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db, client } from '../src/db';
import {
  classGroups,
  courses,
  enrollments,
  integrations,
  interactions,
  mentorshipAttendances,
  modules,
  onboardingItems,
  payments,
  playbooks,
  students,
  studyActivities,
  surveyResponses,
  tickets,
  tracks,
  users,
} from '../src/db/schema';
import { ONBOARDING_CHECKLIST, INTEGRATION_CATALOG } from '../src/lib/constants';
import { classifyNps } from '../src/server/survey-service';
import { ensureDefaultAutomations } from '../src/server/automation-service';
import { runDailyRoutine } from '../src/server/routine';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS } from '../src/lib/health-score';
import { healthScoreConfig } from '../src/db/schema';

const RESET = process.argv.includes('--reset');
const DAY = 86_400_000;

/* PRNG determinístico para o seed ser reproduzível */
let seedState = 20260827;
function rnd() {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const chance = (p: number) => rnd() < p;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY);

const FIRST = [
  'Anderson', 'Beatriz', 'Carlos', 'Daniela', 'Eduardo', 'Fernanda', 'Gustavo', 'Helena',
  'Igor', 'Juliana', 'Kleber', 'Larissa', 'Marcelo', 'Natália', 'Otávio', 'Patrícia',
  'Rafael', 'Simone', 'Thiago', 'Vanessa', 'Wagner', 'Yasmin', 'Bruno', 'Camila',
  'Diego', 'Elaine', 'Fábio', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina',
  'Leandro', 'Mariana', 'Nelson', 'Olívia', 'Paulo', 'Renata', 'Sérgio', 'Tatiane',
];

const LAST = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira',
  'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes',
  'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Moreira',
];

const CITIES: [string, string][] = [
  ['São Paulo', 'SP'], ['Campinas', 'SP'], ['Rio de Janeiro', 'RJ'], ['Belo Horizonte', 'MG'],
  ['Curitiba', 'PR'], ['Porto Alegre', 'RS'], ['Salvador', 'BA'], ['Recife', 'PE'],
  ['Fortaleza', 'CE'], ['Goiânia', 'GO'], ['Manaus', 'AM'], ['Belém', 'PA'],
  ['Florianópolis', 'SC'], ['Vitória', 'ES'], ['Natal', 'RN'], ['Uberlândia', 'MG'],
];

const ORIGINS = [
  'YouTube', 'Instagram', 'Indicação de aluno', 'Meta Ads', 'Google', 'E-mail marketing',
  'WhatsApp', 'Evento presencial',
];

const COURSES = [
  {
    name: 'Reparo em Inversores Solares',
    slug: 'reparo-inversores-solares',
    category: 'Treinamento Especialista',
    workloadHours: 60,
    price: 1997,
    description: 'Diagnóstico e reparo de inversores string e híbridos.',
    tracks: [
      { name: 'Fundamentos', modules: ['Topologias de inversores', 'Instrumentação', 'Segurança em CC'] },
      { name: 'Diagnóstico', modules: ['Falhas de entrada CC', 'Estágio de potência', 'Placa de controle'] },
      { name: 'Reparo', modules: ['Substituição de IGBTs', 'Reprogramação', 'Testes finais'] },
    ],
  },
  {
    name: 'Fontes Chaveadas — Análises e Procedimentos',
    slug: 'fontes-chaveadas',
    category: 'Treinamento Especialista',
    workloadHours: 45,
    price: 1497,
    description: 'Análise, medição e manutenção de fontes chaveadas.',
    tracks: [
      { name: 'Teoria aplicada', modules: ['Retificação e filtragem', 'Topologias flyback', 'Realimentação'] },
      { name: 'Bancada', modules: ['Medições com osciloscópio', 'Falhas típicas', 'Reparo guiado'] },
    ],
  },
  {
    name: 'Eletrônica Básica Aplicada',
    slug: 'eletronica-basica',
    category: 'Formação',
    workloadHours: 40,
    price: 697,
    description: 'Base de eletrônica para manutenção e reparo.',
    tracks: [
      { name: 'Componentes', modules: ['Resistores e capacitores', 'Semicondutores', 'Circuitos integrados'] },
      { name: 'Prática', modules: ['Soldagem', 'Medições básicas', 'Primeiros reparos'] },
    ],
  },
  {
    name: 'Manutenção de Placas Eletrônicas',
    slug: 'manutencao-placas',
    category: 'Formação',
    workloadHours: 50,
    price: 1197,
    description: 'Do diagnóstico ao retrabalho em placas SMD.',
    tracks: [
      { name: 'Diagnóstico', modules: ['Leitura de esquemas', 'Curva característica', 'Térmica'] },
      { name: 'Retrabalho SMD', modules: ['Estação de ar quente', 'BGA', 'Controle de qualidade'] },
    ],
  },
  {
    name: 'Curso Técnico em Eletrônica (Presencial)',
    slug: 'tecnico-eletronica-presencial',
    category: 'Curso Técnico',
    workloadHours: 1200,
    price: 6900,
    description: 'Curso técnico presencial com certificação.',
    tracks: [
      { name: 'Módulo I', modules: ['Eletricidade', 'Eletrônica analógica', 'Laboratório I'] },
      { name: 'Módulo II', modules: ['Eletrônica digital', 'Microcontroladores', 'Laboratório II'] },
      { name: 'Módulo III', modules: ['Automação', 'Projeto integrador', 'Estágio supervisionado'] },
    ],
  },
];

const TEAM = [
  {
    name: 'Celso Muniz',
    email: 'admin@escolainstructiva.com.br',
    role: 'ADMIN' as const,
    avatarColor: '#1d43f5',
  },
  {
    name: 'Edna Muniz de Castro',
    email: 'coordenacao@escolainstructiva.com.br',
    role: 'COORDENADOR' as const,
    avatarColor: '#eb6834',
  },
  {
    name: 'Vanessa Andrade',
    email: 'analista@escolainstructiva.com.br',
    role: 'ANALISTA' as const,
    avatarColor: '#1baf7a',
  },
  {
    name: 'Rodrigo Peixoto',
    email: 'analista2@escolainstructiva.com.br',
    role: 'ANALISTA' as const,
    avatarColor: '#8b5cf6',
  },
  {
    name: 'Marina Belchior',
    email: 'mentor@escolainstructiva.com.br',
    role: 'ANALISTA' as const,
    avatarColor: '#eda100',
  },
];

const PLAYBOOKS = [
  {
    name: 'Onboarding 7 dias',
    trigger: 'NOVO_ALUNO',
    description: 'Régua de entrada do aluno, do acesso à primeira aula concluída.',
    steps: [
      { order: 1, title: 'Boas-vindas no WhatsApp', channel: 'WHATSAPP', offsetDays: 0 },
      { order: 2, title: 'E-mail com tutorial e vídeo institucional', channel: 'EMAIL', offsetDays: 0 },
      { order: 3, title: 'Checar primeiro acesso', channel: 'TAREFA_INTERNA', offsetDays: 2 },
      { order: 4, title: 'Apresentar mentor e comunidade', channel: 'WHATSAPP', offsetDays: 3 },
      { order: 5, title: 'Confirmar cronograma de estudo', channel: 'TAREFA_INTERNA', offsetDays: 5 },
      { order: 6, title: 'Pesquisa CSAT de onboarding', channel: 'WHATSAPP', offsetDays: 7 },
    ],
  },
  {
    name: 'Resgate de aluno parado',
    trigger: 'ALUNO_PARADO',
    description: 'Sequência de reengajamento para quem parou de acessar.',
    steps: [
      { order: 1, title: 'Mensagem de resgate no WhatsApp', channel: 'WHATSAPP', offsetDays: 0 },
      { order: 2, title: 'Ligação de diagnóstico', channel: 'TELEFONE', offsetDays: 2 },
      { order: 3, title: 'Reprogramar cronograma', channel: 'TAREFA_INTERNA', offsetDays: 3 },
      { order: 4, title: 'Convite para mentoria ao vivo', channel: 'EMAIL', offsetDays: 5 },
    ],
  },
  {
    name: 'Recuperação de detrator',
    trigger: 'NPS_BAIXO',
    description: 'Tratativa obrigatória para NPS de 0 a 6.',
    steps: [
      { order: 1, title: 'Ligar em até 48h', channel: 'TELEFONE', offsetDays: 1 },
      { order: 2, title: 'Registrar causa raiz no CRM', channel: 'TAREFA_INTERNA', offsetDays: 1 },
      { order: 3, title: 'Devolutiva ao aluno com solução', channel: 'WHATSAPP', offsetDays: 4 },
      { order: 4, title: 'Reenviar CSAT', channel: 'WHATSAPP', offsetDays: 7 },
    ],
  },
  {
    name: 'Expansão de egresso',
    trigger: 'ALUNO_CERTIFICADO',
    description: 'Transformar aluno certificado em aluno recorrente.',
    steps: [
      { order: 1, title: 'Parabéns + pedido de depoimento', channel: 'EMAIL', offsetDays: 0 },
      { order: 2, title: 'Convite ao grupo de egressos', channel: 'WHATSAPP', offsetDays: 3 },
      { order: 3, title: 'Oferta de próximo treinamento', channel: 'EMAIL', offsetDays: 10 },
    ],
  },
];

async function reset() {
  console.log('→ limpando base…');
  await db.execute(sql`
    truncate table
      assistant_messages, assistant_threads, automation_runs, automations,
      audit_logs, alerts, tasks, action_plans, tickets, interactions,
      survey_responses, health_snapshots, mentorship_attendances, study_activities,
      onboarding_items, journey_events, payments, enrollments, class_groups,
      modules, tracks, courses, students, users, playbooks, integrations,
      health_score_config, metric_snapshots
    restart identity cascade
  `);
}

async function main() {
  console.log('CSCX — seed da Escola Instructiva');
  if (RESET) await reset();

  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length && !RESET) {
    console.log('Base já populada. Use "npm run db:reset" para recriar.');
    await client.end();
    return;
  }

  /* ── Equipe ─────────────────────────────────────────── */
  const passwordHash = await hash(process.env.SEED_PASSWORD ?? 'cscx2026', 10);
  const team = await db
    .insert(users)
    .values(TEAM.map((t) => ({ ...t, passwordHash })))
    .returning();
  console.log(`✓ ${team.length} usuários da equipe`);

  const analysts = team.filter((t) => t.role === 'ANALISTA');
  const mentors = analysts;

  /* ── Configuração do Health Score ───────────────────── */
  await db
    .insert(healthScoreConfig)
    .values({ id: 'default', weights: DEFAULT_WEIGHTS, thresholds: DEFAULT_THRESHOLDS })
    .onConflictDoNothing();

  /* ── Cursos, trilhas, módulos e turmas ──────────────── */
  const courseRows = await db
    .insert(courses)
    .values(
      COURSES.map((c) => ({
        name: c.name,
        slug: c.slug,
        category: c.category,
        description: c.description,
        workloadHours: c.workloadHours,
        price: String(c.price),
      })),
    )
    .returning();

  const moduleNamesByCourse = new Map<string, string[]>();

  for (let i = 0; i < courseRows.length; i++) {
    const course = courseRows[i];
    const def = COURSES[i];
    const names: string[] = [];
    for (let t = 0; t < def.tracks.length; t++) {
      const [track] = await db
        .insert(tracks)
        .values({ courseId: course.id, name: def.tracks[t].name, order: t + 1 })
        .returning();
      await db.insert(modules).values(
        def.tracks[t].modules.map((m, mi) => ({
          trackId: track.id,
          name: m,
          order: mi + 1,
          lessons: int(4, 12),
        })),
      );
      names.push(...def.tracks[t].modules);
    }
    moduleNamesByCourse.set(course.id, names);

    await db.insert(classGroups).values([
      {
        courseId: course.id,
        name: `Turma ${new Date().getFullYear()}.1`,
        startsAt: daysAgo(180),
        endsAt: daysAgo(-30),
      },
      {
        courseId: course.id,
        name: `Turma ${new Date().getFullYear()}.2`,
        startsAt: daysAgo(75),
        endsAt: daysAgo(-105),
      },
    ]);
  }
  console.log(`✓ ${courseRows.length} cursos com trilhas, módulos e turmas`);

  const groups = await db.select().from(classGroups);

  /* ── Playbooks e integrações ────────────────────────── */
  await db.insert(playbooks).values(
    PLAYBOOKS.map((p) => ({
      name: p.name,
      trigger: p.trigger,
      description: p.description,
      steps: p.steps as never,
      createdById: team[1].id,
    })),
  );

  await db.insert(integrations).values(
    INTEGRATION_CATALOG.map((i) => ({
      kind: i.kind as never,
      name: i.name,
      status: 'NAO_CONFIGURADA' as const,
      config: { envKeys: i.envKeys, category: i.category, description: i.description } as never,
    })),
  );

  await ensureDefaultAutomations();
  console.log('✓ playbooks, integrações e automações padrão');

  /* ── Alunos ─────────────────────────────────────────── */
  const TOTAL = Number(process.env.SEED_STUDENTS ?? 72);
  const usedEmails = new Set<string>();
  const createdStudents: { id: string; profile: string }[] = [];

  for (let i = 0; i < TOTAL; i++) {
    const first = pick(FIRST);
    const last = `${pick(LAST)} ${pick(LAST)}`;
    const name = `${first} ${last}`;
    let email = `${first}.${last.split(' ')[0]}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z.]/g, '');
    let suffix = 1;
    let candidate = `${email}@exemplo.com.br`;
    while (usedEmails.has(candidate)) candidate = `${email}${++suffix}@exemplo.com.br`;
    usedEmails.add(candidate);
    email = candidate;

    const [city, state] = pick(CITIES);

    // Perfis: define o comportamento do aluno na base de demonstração.
    const roll = rnd();
    const profile =
      roll < 0.14 ? 'critico' :
      roll < 0.28 ? 'risco' :
      roll < 0.45 ? 'atencao' :
      roll < 0.62 ? 'saudavel' :
      roll < 0.78 ? 'excelente' :
      roll < 0.88 ? 'concluinte' :
      roll < 0.95 ? 'certificado' : 'novo';

    const enrolledDaysAgo =
      profile === 'novo' ? int(0, 6)
      : profile === 'certificado' ? int(160, 300)
      : profile === 'concluinte' ? int(110, 200)
      : int(20, 170);

    const daysNoAccess =
      profile === 'critico' ? int(22, 70)
      : profile === 'risco' ? int(8, 20)
      : profile === 'atencao' ? int(3, 8)
      : profile === 'novo' ? (chance(0.5) ? 999 : int(0, 2))
      : int(0, 3);

    const [student] = await db
      .insert(students)
      .values({
        code: `INS-${String(1000 + i)}`,
        name,
        email,
        phone: `55${int(11, 99)}9${int(10000000, 99999999)}`,
        city,
        state,
        origin: pick(ORIGINS),
        enrolledAt: daysAgo(enrolledDaysAgo),
        ownerId: pick(analysts).id,
        mentorId: pick(mentors).id,
        lastAccessAt: daysNoAccess === 999 ? null : daysAgo(daysNoAccess),
        weeklyGoalHours: pick([3, 4, 5, 6]),
        monthlyGoalHours: pick([12, 16, 20, 24]),
        tags: [profile === 'certificado' ? 'egresso' : profile === 'novo' ? 'novo' : 'ativo'],
      })
      .returning();

    createdStudents.push({ id: student.id, profile });

    /* Onboarding */
    const onboardingDone =
      profile === 'novo' ? int(0, 2)
      : profile === 'critico' ? int(1, 4)
      : profile === 'risco' ? int(3, 5)
      : ONBOARDING_CHECKLIST.length;

    await db.insert(onboardingItems).values(
      ONBOARDING_CHECKLIST.map((c, ci) => ({
        studentId: student.id,
        key: c.key,
        label: c.label,
        order: c.order,
        done: ci < onboardingDone,
        doneAt: ci < onboardingDone ? daysAgo(enrolledDaysAgo - ci) : null,
      })),
    );

    /* Matrículas */
    const courseCount = profile === 'certificado' && chance(0.5) ? 2 : 1;
    const chosen: typeof courseRows = [];
    while (chosen.length < courseCount) {
      const c = pick(courseRows);
      if (!chosen.find((x) => x.id === c.id)) chosen.push(c);
    }

    for (let ci = 0; ci < chosen.length; ci++) {
      const course = chosen[ci];
      const mods = moduleNamesByCourse.get(course.id) ?? ['Módulo 1'];
      const progress =
        profile === 'certificado' ? 100
        : profile === 'concluinte' ? int(80, 97)
        : profile === 'excelente' ? int(45, 78)
        : profile === 'saudavel' ? int(30, 60)
        : profile === 'atencao' ? int(15, 40)
        : profile === 'risco' ? int(5, 25)
        : profile === 'critico' ? int(0, 15)
        : int(0, 5);

      const total = int(8, 20);
      const done = Math.round((progress / 100) * total);
      const status =
        profile === 'certificado' ? ('CONCLUIDA' as const)
        : profile === 'critico' && chance(0.25) ? ('CANCELADA' as const)
        : ('ATIVA' as const);

      const startedAt = daysAgo(enrolledDaysAgo - ci * 40);
      const expected = new Date(startedAt.getTime() + int(90, 160) * DAY);

      await db.insert(enrollments).values({
        studentId: student.id,
        courseId: course.id,
        classGroupId: pick(groups.filter((g) => g.courseId === course.id)).id,
        status,
        progressPercent: progress,
        currentModule: mods[Math.min(mods.length - 1, Math.floor((progress / 100) * mods.length))],
        startedAt,
        expectedFinishAt: expected,
        finishedAt: status === 'CONCLUIDA' ? daysAgo(int(10, 60)) : status === 'CANCELADA' ? daysAgo(int(5, 50)) : null,
        certificateIssuedAt: status === 'CONCLUIDA' ? daysAgo(int(5, 55)) : null,
        gradeAverage:
          done > 0
            ? Math.round(
                (profile === 'excelente' || profile === 'certificado' ? int(80, 98) : int(55, 88)) / 10,
              ) * 1.0
            : null,
        activitiesDone: done,
        activitiesTotal: total,
        value: String(Number(course.price)),
      });
    }

    /* Histórico de estudos (90 dias) */
    const intensity =
      profile === 'excelente' ? 0.62
      : profile === 'certificado' ? 0.5
      : profile === 'concluinte' ? 0.48
      : profile === 'saudavel' ? 0.38
      : profile === 'atencao' ? 0.2
      : profile === 'risco' ? 0.1
      : profile === 'critico' ? 0.05
      : 0.15;

    const activityRows = [];
    for (let d = 89; d >= 0; d--) {
      if (d < daysNoAccess && daysNoAccess !== 999) continue;
      if (daysAgo(d).getTime() < daysAgo(enrolledDaysAgo).getTime()) continue;
      if (!chance(intensity)) continue;
      activityRows.push({
        studentId: student.id,
        date: daysAgo(d),
        minutes: int(20, 130),
        lessonsDone: int(1, 4),
        quizzesDone: chance(0.35) ? 1 : 0,
        score: chance(0.35) ? int(60, 100) / 10 : null,
        communityPosts: chance(0.18) ? int(1, 3) : 0,
      });
    }
    if (activityRows.length) await db.insert(studyActivities).values(activityRows);

    const totalMinutes = activityRows.reduce((s, a) => s + a.minutes, 0);
    await db
      .update(students)
      .set({ studiedHours: Math.round((totalMinutes / 60) * 10) / 10 })
      .where(sql`${students.id} = ${student.id}`);

    /* Mentorias */
    const mentorshipRows = [];
    for (let k = 0; k < int(2, 6); k++) {
      const when = daysAgo(int(1, 60));
      if (when.getTime() < daysAgo(enrolledDaysAgo).getTime()) continue;
      mentorshipRows.push({
        studentId: student.id,
        title: pick([
          'Mentoria ao vivo — diagnóstico de falhas',
          'Plantão de dúvidas',
          'Mentoria de bancada',
          'Sessão de carreira e mercado',
        ]),
        date: when,
        attended:
          profile === 'excelente' || profile === 'certificado'
            ? chance(0.85)
            : profile === 'saudavel'
              ? chance(0.6)
              : chance(0.15),
        minutes: int(40, 90),
      });
    }
    if (mentorshipRows.length) await db.insert(mentorshipAttendances).values(mentorshipRows);

    /* Pesquisas */
    const npsScore =
      profile === 'excelente' || profile === 'certificado' ? int(9, 10)
      : profile === 'saudavel' ? int(7, 9)
      : profile === 'atencao' ? int(6, 8)
      : profile === 'risco' ? int(4, 7)
      : int(0, 6);

    if (profile !== 'novo' && chance(0.82)) {
      const answeredAt = daysAgo(int(1, 80));
      await db.insert(surveyResponses).values({
        studentId: student.id,
        type: 'NPS',
        trigger: pick(['D30', 'D60', 'D90', 'CONCLUSAO'] as const),
        status: 'RESPONDIDA',
        score: npsScore,
        npsClass: classifyNps(npsScore),
        comment:
          npsScore >= 9
            ? pick([
                'Conteúdo direto ao ponto, aplico no dia a dia da bancada.',
                'Melhor curso técnico que já fiz. Suporte excelente.',
                'As mentorias ao vivo fazem toda a diferença.',
              ])
            : npsScore >= 7
              ? pick([
                  'Bom conteúdo, senti falta de mais exercícios práticos.',
                  'Gostei, mas a plataforma poderia ser mais rápida.',
                ])
              : pick([
                  'Estou com dificuldade de acompanhar o ritmo.',
                  'Demorou para responderem minha dúvida.',
                  'Esperava mais prática de bancada.',
                ]),
        sentAt: new Date(answeredAt.getTime() - DAY),
        answeredAt,
      });
    }

    if (profile !== 'novo' && chance(0.7)) {
      const csat =
        profile === 'excelente' || profile === 'certificado' ? int(4, 5)
        : profile === 'saudavel' ? int(4, 5)
        : profile === 'atencao' ? int(3, 4)
        : int(1, 3);
      const answeredAt = daysAgo(int(1, 50));
      await db.insert(surveyResponses).values({
        studentId: student.id,
        type: 'CSAT',
        trigger: pick(['ATENDIMENTO', 'MENTORIA', 'ONBOARDING', 'CONCLUSAO'] as const),
        status: 'RESPONDIDA',
        score: csat,
        comment: csat <= 2 ? 'Não resolveram meu problema de acesso.' : null,
        sentAt: new Date(answeredAt.getTime() - DAY),
        answeredAt,
      });
    }

    /* Pagamentos */
    const parcelas = int(3, 12);
    const valor = Math.round(Number(chosen[0].price) / parcelas);
    const inadimplente = profile === 'critico' ? chance(0.6) : profile === 'risco' ? chance(0.3) : chance(0.06);
    const paymentRows = [];
    for (let p = 0; p < parcelas; p++) {
      const dueAt = new Date(daysAgo(enrolledDaysAgo).getTime() + p * 30 * DAY);
      if (dueAt.getTime() > Date.now() + 30 * DAY) break;
      const vencida = dueAt.getTime() < Date.now();
      const pago = vencida ? !(inadimplente && p >= parcelas - 3) : false;
      paymentRows.push({
        studentId: student.id,
        reference: `Parcela ${p + 1}/${parcelas}`,
        amount: String(valor),
        dueAt,
        paidAt: pago ? new Date(dueAt.getTime() - int(0, 5) * DAY) : null,
        status: pago ? ('EM_DIA' as const) : vencida ? ('ATRASADO' as const) : ('PENDENTE' as const),
        gateway: pick(['asaas', 'mercadopago', 'stripe']),
      });
    }
    if (paymentRows.length) await db.insert(payments).values(paymentRows);

    const pagoTotal = paymentRows.filter((p) => p.paidAt).reduce((s, p) => s + Number(p.amount), 0);
    await db
      .update(students)
      .set({ ltv: String(pagoTotal), mrr: String(valor) })
      .where(sql`${students.id} = ${student.id}`);

    /* Interações e tickets */
    const interactionRows = [];
    for (let k = 0; k < int(1, 7); k++) {
      const when = daysAgo(int(1, 90));
      if (when.getTime() < daysAgo(enrolledDaysAgo).getTime()) continue;
      const entrada = chance(0.4);
      interactionRows.push({
        studentId: student.id,
        userId: pick(analysts).id,
        channel: pick(['WHATSAPP', 'EMAIL', 'TELEFONE', 'PLATAFORMA', 'MENTORIA'] as const),
        direction: entrada ? ('ENTRADA' as const) : ('SAIDA' as const),
        subject: entrada
          ? pick(['Dúvida sobre módulo', 'Problema de acesso', 'Pedido de certificado', 'Reagendamento'])
          : pick(['Check-in mensal', 'Follow-up de progresso', 'Convite para mentoria', 'Retorno de solicitação']),
        content: entrada
          ? 'Aluno entrou em contato pelo canal de atendimento.'
          : 'Contato ativo do time de Customer Success registrado no CRM.',
        responseMinutes: entrada ? int(4, 240) : null,
        createdAt: when,
      });
    }
    if (interactionRows.length) await db.insert(interactions).values(interactionRows);

    if ((profile === 'critico' || profile === 'risco') && chance(0.5)) {
      await db.insert(tickets).values({
        studentId: student.id,
        ownerId: pick(analysts).id,
        subject: pick(['Reclamação sobre suporte', 'Reclamação de acesso', 'Reclamação de cobrança']),
        category: 'Reclamação',
        body: 'Aluno relata insatisfação e aguarda retorno da coordenação.',
        status: pick(['ABERTO', 'EM_ANDAMENTO'] as const),
        firstResponseMinutes: int(30, 600),
        createdAt: daysAgo(int(1, 25)),
      });
    }
  }

  console.log(`✓ ${createdStudents.length} alunos com histórico completo`);

  /* ── Conta de acesso do aluno demonstração ──────────── */
  const demoStudent = createdStudents.find((s) => s.profile === 'atencao') ?? createdStudents[0];
  const [studentRow] = await db
    .select()
    .from(students)
    .where(sql`${students.id} = ${demoStudent.id}`);

  const [studentUser] = await db
    .insert(users)
    .values({
      name: studentRow.name,
      email: 'aluno@exemplo.com.br',
      passwordHash,
      role: 'ALUNO',
      avatarColor: '#2a78d6',
    })
    .returning();

  await db
    .update(students)
    .set({ userId: studentUser.id })
    .where(sql`${students.id} = ${studentRow.id}`);

  console.log(`✓ portal do aluno: aluno@exemplo.com.br → ${studentRow.name}`);

  /* ── Rotina diária: health score, alertas, planos ───── */
  console.log('→ rodando a rotina diária (Health Score, alertas, planos, automações)…');
  const report = await runDailyRoutine();
  console.log('✓ rotina concluída', report);

  // Snapshots históricos para o gráfico de evolução do Health Score.
  await db.execute(sql`
    insert into health_snapshots (student_id, score, band, breakdown, churn_risk, created_at)
    select id,
           greatest(0, least(100, health_score + (random()*24 - 12)::int)),
           health_band,
           '[]'::jsonb,
           greatest(0, least(100, churn_risk + (random()*20 - 10)::int)),
           now() - (g.n || ' days')::interval
    from students, generate_series(7, 150, 7) as g(n)
  `);

  console.log('\n✅ Seed concluído.');
  console.log('   Login:    admin@escolainstructiva.com.br');
  console.log(`   Senha:    ${process.env.SEED_PASSWORD ?? 'cscx2026'}`);
  await client.end();
}

main().catch(async (err) => {
  console.error(err);
  await client.end().catch(() => {});
  process.exit(1);
});
