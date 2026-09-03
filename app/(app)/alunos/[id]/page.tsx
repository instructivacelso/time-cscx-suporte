import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Circle,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Target,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  HealthBadge,
  PageHeader,
  Progress,
  SectionTitle,
  SeverityBadge,
  Stat,
  StatusBadge,
} from '@/components/ui';
import { HealthBreakdown } from '@/components/health-breakdown';
import { WhatsappButton } from '@/components/whatsapp-button';
import { ActionPlanButton } from '@/components/action-plan-button';
import { montarModelosWhatsapp } from '@/lib/whatsapp-templates';
import { aplicarVariaveis, ensureScriptsPadrao, listarScripts } from '@/server/script-service';
import { AiPanel } from '@/components/ai-panel';
import { HealthHistoryChart, StudyChart } from '@/components/charts';
import { getStudent360, studySummary } from '@/server/student-service';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import {
  CHANNEL_LABELS,
  JOURNEY_STAGES,
  STAGE_CHECKLISTS,
  STAGE_DESCRIPTIONS,
  STAGE_LABELS,
} from '@/lib/constants';
import { formatDate, formatDateTime, formatPhone, money, relativeDays } from '@/lib/format';
import {
  addInteractionAction,
  createTaskAction,
  recalcStudentAction,
  sendSurveyAction,
  setStageAction,
  setStudentOwnerAction,
  toggleOnboardingAction,
  updateStudentNotesAction,
  updateTaskStatusAction,
} from '@/app/actions';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'visao', label: 'Visão geral' },
  { key: 'estudos', label: 'Estudos' },
  { key: 'health', label: 'Health Score' },
  { key: 'jornada', label: 'Jornada' },
  { key: 'crm', label: 'CRM' },
  { key: 'pesquisas', label: 'Pesquisas' },
  { key: 'planos', label: 'Tarefas & planos' },
  { key: 'financeiro', label: 'Financeiro' },
];

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = 'visao' } = await searchParams;
  const session = await getSession();

  const s = await getStudent360(id);
  if (!s) notFound();

  const study = studySummary(s);

  // Scripts de WhatsApp escritos pela equipe (tela Scripts). Se ainda não
  // houver nenhum, o botão usa os modelos embutidos.
  await ensureScriptsPadrao().catch(() => null);
  const scriptsWhats = await listarScripts({ canal: 'WHATSAPP', apenasAtivos: true }).catch(() => []);
  const contextoScript = {
    nome: s.student.name,
    curso: s.enrollments[0]?.course?.name ?? null,
    progresso: s.student.progressPercent,
    diasSemAcesso: s.student.daysWithoutAccess,
    link: process.env.LMS_STUDENT_URL ?? null,
    analista: session?.name,
  };
  const modelosWhats = scriptsWhats.length
    ? scriptsWhats.map((sc) => ({
        chave: sc.id,
        titulo: sc.title,
        texto: aplicarVariaveis(sc.content, contextoScript),
      }))
    : montarModelosWhatsapp({
        nome: s.student.name,
        curso: s.enrollments[0]?.course?.name ?? null,
        diasSemAcesso: s.student.daysWithoutAccess,
        progresso: s.student.progressPercent,
        etapa: STAGE_LABELS[s.student.stage],
        linkAmbiente: process.env.LMS_STUDENT_URL ?? null,
      });
  const team = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.active, true));

  const stageIdx = JOURNEY_STAGES.indexOf(s.student.stage);

  return (
    <>
      <Link href="/alunos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Carteira
      </Link>

      <div className="card card-pad mb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar name={s.student.name} color="#2a78d6" size={56} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-ink-950">{s.student.name}</h1>
              <HealthBadge band={s.student.healthBand} score={s.student.healthScore} />
              <Badge tone="brand">{STAGE_LABELS[s.student.stage]}</Badge>
              {s.student.churnRisk >= 70 && (
                <Badge tone="red">
                  <AlertTriangle className="h-3 w-3" /> risco {s.student.churnRisk}%
                </Badge>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {s.student.email}
              </span>
              {s.student.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {formatPhone(s.student.phone)}
                </span>
              )}
              {s.student.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {s.student.city}/{s.student.state}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> matrícula em{' '}
                {formatDate(s.student.enrolledAt)}
              </span>
              <span>código {s.student.code}</span>
              {s.student.origin && <span>origem: {s.student.origin}</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {can(session?.role, 'interacao.create') && (
              <WhatsappButton
                studentId={s.student.id}
                nome={s.student.name}
                telefone={s.student.phone}
                modelos={modelosWhats}
              />
            )}
            {can(session?.role, 'aluno.healthScore.update') && (
              <form action={recalcStudentAction}>
                <input type="hidden" name="studentId" value={s.student.id} />
                <button className="btn-ghost" type="submit">
                  <RefreshCw className="h-4 w-4" /> Recalcular
                </button>
              </form>
            )}
            {can(session?.role, 'pesquisa.send') && (
              <form action={sendSurveyAction}>
                <input type="hidden" name="studentId" value={s.student.id} />
                <input type="hidden" name="type" value="NPS" />
                <button className="btn-ghost" type="submit">
                  Enviar NPS
                </button>
              </form>
            )}
            {can(session?.role, 'planoAcao.manage') && (
              <ActionPlanButton studentId={s.student.id} />
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Health Score" value={`${s.student.healthScore}/100`} />
          <Stat label="Progresso" value={`${Math.round(s.student.progressPercent)}%`} />
          <Stat label="Onboarding" value={`${Math.round(s.student.onboardingPercent)}%`} />
          <Stat
            label="Último acesso"
            value={s.student.lastAccessAt ? relativeDays(s.student.lastAccessAt) : 'nunca'}
          />
          <Stat label="Horas estudadas" value={`${study.horasTotais}h`} />
          <Stat label="NPS" value={s.student.npsLast ?? '—'} />
          <Stat label="CSAT" value={s.student.csatLast ? `${s.student.csatLast}/5` : '—'} />
        </div>
      </div>

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1 shadow-card">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/alunos/${s.student.id}?tab=${t.key}`}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
              tab === t.key
                ? 'bg-brand-50 font-medium text-brand-700'
                : 'text-ink-600 hover:bg-surface-3'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* ── VISÃO GERAL ────────────────────────────────── */}
      {tab === 'visao' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <SectionTitle title="Matrículas" />
              <div className="space-y-3">
                {s.enrollments.map(({ enrollment, course, classGroup }) => (
                  <div key={enrollment.id} className="rounded-lg border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink-900">{course?.name}</span>
                      <StatusBadge status={enrollment.status} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-ink-500 sm:grid-cols-4">
                      <span>Turma: {classGroup?.name ?? '—'}</span>
                      <span>Módulo atual: {enrollment.currentModule ?? '—'}</span>
                      <span>
                        Atividades: {enrollment.activitiesDone}/{enrollment.activitiesTotal}
                      </span>
                      <span>Média: {enrollment.gradeAverage ?? '—'}</span>
                      <span>Início: {formatDate(enrollment.startedAt)}</span>
                      <span>Previsão: {formatDate(enrollment.expectedFinishAt)}</span>
                      <span>Certificado: {formatDate(enrollment.certificateIssuedAt)}</span>
                      <span>Valor: {money(enrollment.value)}</span>
                    </div>
                    <Progress className="mt-2" value={enrollment.progressPercent} showLabel />
                  </div>
                ))}
                {s.enrollments.length === 0 && (
                  <p className="py-4 text-center text-sm text-ink-500">Nenhuma matrícula.</p>
                )}
              </div>
            </Card>

            <Card>
              <SectionTitle title="Alertas abertos" description="Gerados automaticamente pelas regras do CSCX." />
              <ul className="space-y-2">
                {s.alerts.map((a) => (
                  <li key={a.id} className="rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink-900">{a.title}</span>
                      <SeverityBadge severity={a.severity} />
                    </div>
                    <p className="mt-1 text-xs text-ink-600">{a.description}</p>
                    <p className="mt-1 text-[11px] text-ink-400">
                      aberto {relativeDays(a.createdAt)}
                    </p>
                  </li>
                ))}
                {s.alerts.length === 0 && (
                  <li className="py-4 text-center text-sm text-ink-500">
                    Nenhum alerta aberto para este aluno.
                  </li>
                )}
              </ul>
            </Card>

            <AiPanel studentId={s.student.id} studentName={s.student.name} />
          </div>

          <div className="space-y-4">
            <Card>
              <SectionTitle title="Atendimento" />
              <div className="space-y-3">
                <div>
                  <span className="label">Analista responsável</span>
                  <form action={setStudentOwnerAction} className="mt-1 flex gap-2">
                    <input type="hidden" name="studentId" value={s.student.id} />
                    <select name="ownerId" defaultValue={s.student.ownerId ?? ''} className="input">
                      <option value="">Sem responsável</option>
                      {team.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button className="btn-ghost" type="submit">
                      Salvar
                    </button>
                  </form>
                </div>
                <Stat label="Mentor" value={s.mentor?.name ?? '—'} />
                <Stat label="Situação financeira" value={<StatusBadge status={s.student.paymentStatus} />} />
                <Stat label="Origem" value={s.student.origin ?? '—'} />
                <Stat label="Tags" value={s.student.tags.join(', ') || '—'} />
              </div>
            </Card>

            <Card>
              <SectionTitle title="Observações" />
              <form action={updateStudentNotesAction} className="space-y-2">
                <input type="hidden" name="studentId" value={s.student.id} />
                <textarea
                  name="notes"
                  rows={5}
                  defaultValue={s.student.notes ?? ''}
                  className="input"
                  placeholder="Contexto do aluno, combinados, particularidades…"
                />
                <button className="btn-primary w-full" type="submit">
                  Salvar observações
                </button>
              </form>
            </Card>

            <Card>
              <SectionTitle title="Metas" />
              <Stat label="Meta semanal" value={`${s.student.weeklyGoalHours}h`} />
              <div className="mt-2">
                <span className="label">Aderência à meta semanal</span>
                <Progress className="mt-1" value={study.aderenciaSemanal} showLabel tone="green" />
              </div>
              <div className="mt-3">
                <Stat label="Meta mensal" value={`${s.student.monthlyGoalHours}h`} />
              </div>
              <div className="mt-3">
                <Stat
                  label="Previsão de conclusão"
                  value={formatDate(study.previsaoConclusao)}
                />
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── ESTUDOS ────────────────────────────────────── */}
      {tab === 'estudos' && (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionTitle title="Evolução dos estudos" description="Horas por dia nos últimos 45 dias." />
            <StudyChart data={s.activities} />
          </Card>

          <Card>
            <SectionTitle title="Resumo" />
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Horas totais" value={`${study.horasTotais}h`} />
              <Stat label="Horas (30d)" value={`${study.horas30}h`} />
              <Stat label="Dias ativos (30d)" value={study.diasAtivos30} />
              <Stat label="Média diária" value={`${study.mediaDiaria} min`} />
              <Stat label="Aulas (30d)" value={study.aulas30} />
              <Stat label="Atividades" value={study.atividades} />
              <Stat label="Média das notas" value={study.media ?? '—'} />
              <Stat label="Módulo atual" value={study.moduloAtual} />
              <Stat
                label="Mentorias assistidas"
                value={`${study.mentoriasAssistidas}/${study.mentoriasOferecidas}`}
              />
              <Stat label="Dias sem acessar" value={s.student.daysWithoutAccess} />
            </div>
          </Card>

          <Card className="lg:col-span-3">
            <SectionTitle title="Mentorias" />
            <ul className="divide-y divide-line">
              {s.mentorships.map((m, i) => (
                <li key={i} className="flex items-center gap-3 py-2 text-sm">
                  {m.attended ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-ink-300" />
                  )}
                  <span className="flex-1 text-ink-800">{m.title}</span>
                  <span className="text-xs text-ink-500">{formatDate(m.date)}</span>
                </li>
              ))}
              {s.mentorships.length === 0 && (
                <li className="py-4 text-center text-sm text-ink-500">Nenhuma mentoria registrada.</li>
              )}
            </ul>
          </Card>
        </div>
      )}

      {/* ── HEALTH SCORE ───────────────────────────────── */}
      {tab === 'health' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionTitle
              title="Por que o aluno recebeu essa pontuação"
              description="Cada indicador com a nota bruta, o peso e a contribuição na nota final."
            />
            {s.healthResult ? (
              <HealthBreakdown result={s.healthResult} />
            ) : (
              <p className="text-sm text-ink-500">Sem dados suficientes.</p>
            )}
          </Card>

          <Card>
            <SectionTitle title="Evolução" description="Health Score e risco de evasão." />
            <HealthHistoryChart data={s.healthHistory} />
          </Card>
        </div>
      )}

      {/* ── JORNADA ────────────────────────────────────── */}
      {tab === 'jornada' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionTitle
              title="Timeline da jornada"
              description={STAGE_DESCRIPTIONS[s.student.stage]}
              action={
                can(session?.role, 'aluno.edit') ? (
                  <form action={setStageAction} className="flex gap-2">
                    <input type="hidden" name="studentId" value={s.student.id} />
                    <select name="stage" defaultValue={s.student.stage} className="input py-1 text-xs">
                      {JOURNEY_STAGES.map((st) => (
                        <option key={st} value={st}>
                          {STAGE_LABELS[st]}
                        </option>
                      ))}
                    </select>
                    <button className="btn-ghost px-2 py-1 text-xs" type="submit">
                      Mover
                    </button>
                  </form>
                ) : undefined
              }
            />

            <ol className="relative ml-3 border-l border-line">
              {JOURNEY_STAGES.map((stage, i) => {
                const done = i < stageIdx;
                const current = i === stageIdx;
                return (
                  <li key={stage} className="mb-4 ml-5">
                    <span
                      className={`absolute -left-[9px] mt-1 grid h-4 w-4 place-items-center rounded-full ring-4 ring-surface ${
                        done ? 'bg-emerald-500' : current ? 'bg-brand-600' : 'bg-ink-300'
                      }`}
                    />
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm ${current ? 'font-semibold text-brand-700' : done ? 'text-ink-700' : 'text-ink-400'}`}
                      >
                        {STAGE_LABELS[stage]}
                      </span>
                      {current && <Badge tone="brand">etapa atual</Badge>}
                    </div>
                    {(current || done) && (
                      <ul className="mt-1.5 space-y-1">
                        {STAGE_CHECKLISTS[stage].map((item) => (
                          <li key={item} className="flex items-center gap-2 text-xs text-ink-600">
                            {done ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-ink-300" />
                            )}
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>

          <div className="space-y-4">
            <Card>
              <SectionTitle
                title="Checklist de onboarding"
                description={`${Math.round(s.student.onboardingPercent)}% concluído`}
              />
              <Progress className="mb-3" value={s.student.onboardingPercent} tone="green" showLabel />
              <ul className="space-y-1.5">
                {s.onboarding.map((item) => (
                  <li key={item.id}>
                    <form action={toggleOnboardingAction} className="flex items-center gap-2">
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="done" value={String(!item.done)} />
                      <button
                        type="submit"
                        className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-surface-2"
                        disabled={!can(session?.role, 'onboarding.manage')}
                      >
                        {item.done ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-ink-300" />
                        )}
                        <span className={item.done ? 'text-ink-500 line-through' : 'text-ink-800'}>
                          {item.label}
                        </span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <SectionTitle title="Histórico de etapas" />
              <ul className="space-y-2">
                {s.journey.map((e) => (
                  <li key={e.id} className="text-xs">
                    <span className="font-medium text-ink-800">
                      {e.fromStage ? `${STAGE_LABELS[e.fromStage]} → ` : ''}
                      {STAGE_LABELS[e.stage]}
                    </span>
                    <span className="ml-2 text-ink-400">{formatDateTime(e.createdAt)}</span>
                    {e.note && <p className="text-ink-500">{e.note}</p>}
                  </li>
                ))}
                {s.journey.length === 0 && <li className="text-sm text-ink-500">Sem movimentações.</li>}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* ── CRM ────────────────────────────────────────── */}
      {tab === 'crm' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionTitle title="Histórico de interações" />
            <ul className="divide-y divide-line">
              {s.interactions.map((i) => (
                <li key={i.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={i.direction === 'ENTRADA' ? 'violet' : 'brand'}>
                      {CHANNEL_LABELS[i.channel] ?? i.channel}
                    </Badge>
                    <span className="text-sm font-medium text-ink-900">{i.subject}</span>
                    <span className="ml-auto text-xs text-ink-400">{formatDateTime(i.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-ink-600">{i.content}</p>
                  {i.responseMinutes !== null && (
                    <p className="mt-1 text-[11px] text-ink-400">
                      tempo de resposta: {i.responseMinutes} min
                    </p>
                  )}
                </li>
              ))}
              {s.interactions.length === 0 && (
                <li className="py-6 text-center text-sm text-ink-500">Nenhuma interação registrada.</li>
              )}
            </ul>
          </Card>

          <div className="space-y-4">
            <Card>
              <SectionTitle title="Registrar contato" />
              <form action={addInteractionAction} className="space-y-2">
                <input type="hidden" name="studentId" value={s.student.id} />
                <select name="channel" className="input">
                  {['WHATSAPP', 'EMAIL', 'TELEFONE', 'PLATAFORMA', 'MENTORIA', 'PRESENCIAL', 'OUTRO'].map(
                    (c) => (
                      <option key={c} value={c}>
                        {CHANNEL_LABELS[c] ?? c}
                      </option>
                    ),
                  )}
                </select>
                <select name="direction" className="input">
                  <option value="SAIDA">Contato ativo (nós → aluno)</option>
                  <option value="ENTRADA">Recebido (aluno → nós)</option>
                </select>
                <input name="subject" className="input" placeholder="Assunto" required />
                <textarea name="content" rows={4} className="input" placeholder="O que foi tratado" required />
                <input
                  name="responseMinutes"
                  type="number"
                  min={0}
                  className="input"
                  placeholder="Tempo de resposta (min) — opcional"
                />
                <button className="btn-primary w-full" type="submit">
                  Registrar
                </button>
              </form>
            </Card>

            <Card>
              <SectionTitle title="Tickets" />
              <ul className="space-y-2">
                {s.tickets.map((t) => (
                  <li key={t.id} className="rounded-lg border border-line p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink-900">{t.subject}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="mt-1 text-xs text-ink-600">{t.body}</p>
                    <p className="mt-1 text-[11px] text-ink-400">
                      {t.category} · {formatDate(t.createdAt)}
                    </p>
                  </li>
                ))}
                {s.tickets.length === 0 && <li className="text-sm text-ink-500">Nenhum ticket.</li>}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* ── PESQUISAS ──────────────────────────────────── */}
      {tab === 'pesquisas' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionTitle title="Pesquisas do aluno" />
            <div className="table-wrap">
              <table className="min-w-full divide-y divide-line">
                <thead className="bg-surface-2/60">
                  <tr>
                    <th className="th">Tipo</th>
                    <th className="th">Gatilho</th>
                    <th className="th">Status</th>
                    <th className="th">Nota</th>
                    <th className="th">Comentário</th>
                    <th className="th">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {s.surveys.map((v) => (
                    <tr key={v.id}>
                      <td className="td">
                        <Badge tone={v.type === 'NPS' ? 'brand' : 'violet'}>{v.type}</Badge>
                      </td>
                      <td className="td text-ink-600">{v.trigger}</td>
                      <td className="td">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="td font-medium">
                        {v.score ?? '—'}
                        {v.npsClass ? ` (${v.npsClass.toLowerCase()})` : ''}
                      </td>
                      <td className="td max-w-[280px] truncate text-ink-600">{v.comment ?? '—'}</td>
                      <td className="td text-ink-500">{formatDate(v.answeredAt ?? v.createdAt)}</td>
                    </tr>
                  ))}
                  {s.surveys.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-500">
                        Nenhuma pesquisa enviada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Disparar pesquisa" />
            <form action={sendSurveyAction} className="space-y-2">
              <input type="hidden" name="studentId" value={s.student.id} />
              <select name="type" className="input">
                <option value="NPS">NPS (0 a 10)</option>
                <option value="CSAT">CSAT (1 a 5 estrelas)</option>
              </select>
              <select name="trigger" className="input">
                {['MANUAL', 'ATENDIMENTO', 'MENTORIA', 'ONBOARDING', 'CONCLUSAO', 'D30', 'D60', 'D90'].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ),
                )}
              </select>
              <button className="btn-primary w-full" type="submit">
                Enviar pesquisa
              </button>
            </form>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
              O envio usa a automação correspondente. Sem as chaves de WhatsApp/SMTP configuradas em
              Integrações, o disparo fica registrado em modo simulado.
            </p>
          </Card>
        </div>
      )}

      {/* ── TAREFAS E PLANOS ───────────────────────────── */}
      {tab === 'planos' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionTitle title="Planos de ação" />
            <div className="space-y-3">
              {s.actionPlans.map((p) => (
                <div key={p.id} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink-900">{p.title}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-1 text-xs text-ink-600">
                    <strong>Motivo:</strong> {p.reason}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-ink-600">
                    {p.strategy}
                  </pre>
                  <p className="mt-2 text-[11px] text-ink-400">
                    prazo {formatDate(p.dueAt)} · criado {formatDate(p.createdAt)}
                    {p.generatedByAi ? ' · gerado por IA' : ''}
                  </p>
                </div>
              ))}
              {s.actionPlans.length === 0 && (
                <p className="py-6 text-center text-sm text-ink-500">Nenhum plano de ação.</p>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <SectionTitle title="Tarefas" />
              <ul className="space-y-2">
                {s.tasks.map((t) => (
                  <li key={t.id} className="rounded-lg border border-line p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-ink-800">{t.title}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[11px] text-ink-400">
                        {t.priority} · prazo {formatDate(t.dueAt)}
                      </span>
                      {t.status !== 'CONCLUIDA' && (
                        <form action={updateTaskStatusAction}>
                          <input type="hidden" name="taskId" value={t.id} />
                          <input type="hidden" name="status" value="CONCLUIDA" />
                          <button className="text-[11px] font-medium text-brand-600 hover:underline">
                            concluir
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
                {s.tasks.length === 0 && <li className="text-sm text-ink-500">Nenhuma tarefa.</li>}
              </ul>
            </Card>

            <Card>
              <SectionTitle title="Nova tarefa" />
              <form action={createTaskAction} className="space-y-2">
                <input type="hidden" name="studentId" value={s.student.id} />
                <input name="title" className="input" placeholder="O que precisa ser feito" required />
                <textarea name="description" rows={3} className="input" placeholder="Detalhes" />
                <div className="grid grid-cols-2 gap-2">
                  <select name="priority" className="input">
                    {['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <input name="dueAt" type="date" className="input" />
                </div>
                <select name="ownerId" defaultValue={s.student.ownerId ?? ''} className="input">
                  <option value="">Responsável…</option>
                  {team.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button className="btn-primary w-full" type="submit">
                  Criar tarefa
                </button>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* ── FINANCEIRO ─────────────────────────────────── */}
      {tab === 'financeiro' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionTitle title="Parcelas" />
            <div className="table-wrap">
              <table className="min-w-full divide-y divide-line">
                <thead className="bg-surface-2/60">
                  <tr>
                    <th className="th">Referência</th>
                    <th className="th">Valor</th>
                    <th className="th">Vencimento</th>
                    <th className="th">Pagamento</th>
                    <th className="th">Status</th>
                    <th className="th">Gateway</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {s.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="td">{p.reference}</td>
                      <td className="td">{money(p.amount)}</td>
                      <td className="td">{formatDate(p.dueAt)}</td>
                      <td className="td">{formatDate(p.paidAt)}</td>
                      <td className="td">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="td text-ink-500">{p.gateway}</td>
                    </tr>
                  ))}
                  {s.payments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-500">
                        Nenhuma cobrança registrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Resumo financeiro" />
            <div className="space-y-3">
              <Stat label="Situação" value={<StatusBadge status={s.student.paymentStatus} />} />
              <Stat label="LTV (pago até aqui)" value={money(s.student.ltv)} />
              <Stat label="Ticket mensal" value={money(s.student.mrr)} />
              <Stat
                label="Parcelas em atraso"
                value={s.payments.filter((p) => !p.paidAt && p.dueAt < new Date()).length}
              />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
