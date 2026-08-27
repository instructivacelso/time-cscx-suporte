/**
 * Integração com a Cademí (área de membros da Escola Instructiva).
 *
 * A Cademí envia webhooks de saída quando algo acontece com o aluno:
 * usuário criado, entrega (curso) adicionada, progresso registrado,
 * certificado emitido e provas aprovadas ou reprovadas. Aqui esses eventos
 * viram alunos, matrículas e histórico dentro do CSCX — e o onboarding
 * começa sozinho.
 *
 * O formato exato do corpo pode variar entre versões da plataforma, então a
 * leitura é tolerante: procuramos o e-mail, o nome e o produto em qualquer
 * lugar do JSON, com os nomes de campo mais prováveis. O corpo bruto fica
 * guardado em `webhook_events` para conferência.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { courses, enrollments, students, studyActivities, webhookEvents } from '@/db/schema';
import { ensureOnboardingChecklist } from '@/server/journey-service';
import { runAutomations } from '@/server/automation-service';
import { refreshStudent } from '@/server/routine';
import { createSurvey } from '@/server/survey-service';

/* ── Leitura tolerante do payload ───────────────────────── */

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Procura a primeira chave com um desses nomes, em qualquer profundidade. */
function buscar(raiz: unknown, nomes: string[], profundidade = 0): unknown {
  if (profundidade > 6 || !isObj(raiz)) return undefined;

  for (const nome of nomes) {
    for (const [chave, valor] of Object.entries(raiz)) {
      if (chave.toLowerCase().replace(/[_-]/g, '') === nome && valor !== null && valor !== '') {
        return valor;
      }
    }
  }
  for (const valor of Object.values(raiz)) {
    if (isObj(valor)) {
      const achado = buscar(valor, nomes, profundidade + 1);
      if (achado !== undefined) return achado;
    }
    if (Array.isArray(valor)) {
      for (const item of valor) {
        const achado = buscar(item, nomes, profundidade + 1);
        if (achado !== undefined) return achado;
      }
    }
  }
  return undefined;
}

const texto = (v: unknown) => (v === undefined || v === null ? null : String(v).trim() || null);
const numero = (v: unknown) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export interface CademiPayload {
  eventType: string | null;
  email: string | null;
  nome: string | null;
  telefone: string | null;
  produto: string | null;
  progresso: number | null;
  nota: number | null;
}

/**
 * Quando o campo procurado vem como objeto (`"product": { "id": 5, "name": "…" }`),
 * pega o nome de dentro dele em vez de virar "[object Object]".
 */
function nomeDe(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  if (!isObj(valor)) return texto(valor);

  const interno = buscar(valor, ['nome', 'name', 'titulo', 'title', 'descricao', 'description']);
  return interno !== undefined && !isObj(interno) ? texto(interno) : null;
}

export function lerPayload(body: unknown): CademiPayload {
  // Procura primeiro dentro do bloco do usuário e do bloco do produto, para
  // não confundir o nome do aluno com o nome do curso.
  const blocoUsuario = buscar(body, ['user', 'usuario', 'aluno', 'cliente', 'customer', 'comprador']);
  const escopoUsuario = isObj(blocoUsuario) ? blocoUsuario : body;
  const blocoProduto = buscar(body, ['produto', 'product', 'curso', 'course', 'entrega', 'turma', 'oferta']);

  const acharNoUsuario = (nomes: string[]) => buscar(escopoUsuario, nomes) ?? buscar(body, nomes);

  const emailBruto = texto(acharNoUsuario(['email', 'emailaluno', 'emailusuario', 'usuarioemail']));

  const tipoBruto = buscar(body, ['eventtype', 'evento', 'tipo', 'type']);
  const eventType = isObj(tipoBruto) ? null : texto(tipoBruto);

  return {
    eventType,
    email: emailBruto ? emailBruto.toLowerCase() : null,
    nome: texto(acharNoUsuario(['nome', 'name', 'nomecompleto', 'fullname', 'nomealuno'])),
    telefone: texto(acharNoUsuario(['telefone', 'phone', 'celular', 'whatsapp', 'fone'])),
    produto: nomeDe(blocoProduto) ?? texto(buscar(body, ['nomeproduto', 'produtonome', 'nomecurso'])),
    progresso: numero(buscar(body, ['progresso', 'progress', 'percentual', 'percent', 'porcentagem'])),
    nota: numero(buscar(body, ['nota', 'score', 'pontuacao', 'grade', 'acertos'])),
  };
}

/**
 * O `event_type` da Cademí vem em texto ("usuario_criado", "Entrega
 * Adicionada"…). Classificamos por palavra-chave para não quebrar quando a
 * plataforma mudar a grafia.
 */
export type AcaoCademi =
  | 'NOVO_ALUNO'
  | 'CURSO_LIBERADO'
  | 'PROGRESSO'
  | 'CERTIFICADO'
  | 'PROVA'
  | 'IGNORAR';

export function classificar(eventType: string | null): AcaoCademi {
  const e = (eventType ?? '').toLowerCase();
  if (e.includes('entrega') || e.includes('matricul') || e.includes('libera')) return 'CURSO_LIBERADO';
  if (e.includes('certificad')) return 'CERTIFICADO';
  if (e.includes('progress')) return 'PROGRESSO';
  if (e.includes('prova') || e.includes('exam')) return 'PROVA';
  if (e.includes('usuario') || e.includes('user') || e.includes('aluno')) return 'NOVO_ALUNO';
  return 'IGNORAR';
}

/* ── Escrita no banco ───────────────────────────────────── */

function slugificar(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Encontra o curso pelo nome vindo da Cademí ou cria um novo. */
async function garantirCurso(nome: string) {
  const slug = slugificar(nome) || 'curso';
  const [existente] = await db.select().from(courses).where(eq(courses.slug, slug));
  if (existente) return existente;

  const [criado] = await db
    .insert(courses)
    .values({ name: nome, slug, category: 'Cademí' })
    .returning();
  return criado;
}

async function proximoCodigo() {
  const [{ total }] = (await db
    .select({ total: sql<number>`count(*)::int` })
    .from(students)) as { total: number }[];
  return `INS-${String(1000 + total + 1)}`;
}

/** Cria o aluno se ainda não existir; devolve o registro e se é novo. */
async function garantirAluno(dados: CademiPayload) {
  const email = dados.email!;
  const [existente] = await db.select().from(students).where(eq(students.email, email));

  if (existente) {
    // Completa o que estiver faltando, sem sobrescrever o que já foi editado.
    if ((!existente.phone && dados.telefone) || (dados.nome && existente.name !== dados.nome)) {
      await db
        .update(students)
        .set({
          phone: existente.phone ?? dados.telefone,
          name: existente.name || dados.nome || existente.name,
          updatedAt: new Date(),
        })
        .where(eq(students.id, existente.id));
    }
    return { aluno: existente, novo: false };
  }

  const [criado] = await db
    .insert(students)
    .values({
      code: await proximoCodigo(),
      name: dados.nome ?? email.split('@')[0],
      email,
      phone: dados.telefone,
      origin: 'Cademí',
      enrolledAt: new Date(),
      tags: ['cademi'],
    })
    .returning();

  await ensureOnboardingChecklist(criado.id);
  await runAutomations('NOVO_ALUNO', { studentId: criado.id });

  return { aluno: criado, novo: true };
}

export interface ResultadoCademi {
  status: 'PROCESSADO' | 'IGNORADO' | 'ERRO';
  message: string;
  studentId?: string;
  acao: AcaoCademi;
}

/**
 * Processa um webhook da Cademí. Nunca lança: qualquer problema volta como
 * status ERRO, porque a plataforma reenvia quando recebe erro HTTP e não
 * queremos criar aluno duplicado por causa de uma falha de mapeamento.
 */
export async function processarWebhookCademi(body: unknown): Promise<ResultadoCademi> {
  const dados = lerPayload(body);
  const acao = classificar(dados.eventType);

  if (acao === 'IGNORAR') {
    return { status: 'IGNORADO', message: `Evento "${dados.eventType ?? '?'}" não é tratado.`, acao };
  }
  if (!dados.email) {
    return { status: 'ERRO', message: 'Não encontrei o e-mail do aluno no corpo do webhook.', acao };
  }

  const { aluno, novo } = await garantirAluno(dados);
  let message = novo ? 'Aluno criado e onboarding iniciado.' : 'Aluno já existia.';

  if (acao === 'CURSO_LIBERADO' && dados.produto) {
    const curso = await garantirCurso(dados.produto);
    await db
      .insert(enrollments)
      .values({ studentId: aluno.id, courseId: curso.id, status: 'ATIVA' })
      .onConflictDoNothing();
    message += ` Matriculado em "${curso.name}".`;
  }

  if (acao === 'PROGRESSO' && dados.produto && dados.progresso !== null) {
    const curso = await garantirCurso(dados.produto);
    await db
      .insert(enrollments)
      .values({
        studentId: aluno.id,
        courseId: curso.id,
        status: 'ATIVA',
        progressPercent: dados.progresso,
      })
      .onConflictDoUpdate({
        target: [enrollments.studentId, enrollments.courseId],
        set: { progressPercent: dados.progresso },
      });

    await db
      .update(students)
      .set({ lastAccessAt: new Date(), daysWithoutAccess: 0 })
      .where(eq(students.id, aluno.id));

    if (dados.progresso >= 80 && dados.progresso < 100) {
      await runAutomations('ALUNO_CONCLUINDO', {
        studentId: aluno.id,
        vars: { curso: curso.name, progresso: Math.round(dados.progresso) },
      });
    }
    message += ` Progresso em "${curso.name}": ${Math.round(dados.progresso)}%.`;
  }

  if (acao === 'CERTIFICADO' && dados.produto) {
    const curso = await garantirCurso(dados.produto);
    const agora = new Date();
    await db
      .insert(enrollments)
      .values({
        studentId: aluno.id,
        courseId: curso.id,
        status: 'CONCLUIDA',
        progressPercent: 100,
        finishedAt: agora,
        certificateIssuedAt: agora,
      })
      .onConflictDoUpdate({
        target: [enrollments.studentId, enrollments.courseId],
        set: {
          status: 'CONCLUIDA',
          progressPercent: 100,
          finishedAt: agora,
          certificateIssuedAt: agora,
        },
      });

    await runAutomations('ALUNO_CERTIFICADO', { studentId: aluno.id, vars: { curso: curso.name } });
    await createSurvey({ studentId: aluno.id, type: 'NPS', trigger: 'CONCLUSAO' });
    message += ` Certificado de "${curso.name}" registrado.`;
  }

  if (acao === 'PROVA') {
    await db.insert(studyActivities).values({
      studentId: aluno.id,
      date: new Date(),
      minutes: 0,
      lessonsDone: 0,
      quizzesDone: 1,
      score: dados.nota,
    });
    await db
      .update(students)
      .set({ lastAccessAt: new Date(), daysWithoutAccess: 0 })
      .where(eq(students.id, aluno.id));
    message += dados.nota !== null ? ` Prova registrada (nota ${dados.nota}).` : ' Prova registrada.';
  }

  await refreshStudent(aluno.id);

  return { status: 'PROCESSADO', message, studentId: aluno.id, acao };
}

/** Guarda o corpo bruto e o desfecho, para conferência na tela de Integrações. */
export async function registrarWebhook(input: {
  source: string;
  body: unknown;
  eventType: string | null;
  email: string | null;
  studentId?: string;
  status: string;
  message: string;
}) {
  try {
    await db.insert(webhookEvents).values({
      source: input.source,
      eventType: input.eventType,
      email: input.email,
      studentId: input.studentId ?? null,
      status: input.status,
      message: input.message,
      payload: (input.body ?? {}) as never,
    });
  } catch (err) {
    console.error('[webhook] não consegui registrar o recebimento:', err);
  }
}

/** Últimos webhooks recebidos, para a tela de Integrações. */
export async function ultimosWebhooks(limite = 10) {
  return db
    .select()
    .from(webhookEvents)
    .orderBy(sql`${webhookEvents.receivedAt} desc`)
    .limit(limite);
}

/** Remove registros antigos — o histórico bruto não precisa crescer para sempre. */
export async function limparWebhooksAntigos(dias = 30) {
  await db.delete(webhookEvents).where(sql`${webhookEvents.receivedAt} < now() - ${`${dias} days`}::interval`);
}
