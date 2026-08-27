import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { alerts, courses, enrollments, students, surveyResponses, users } from '@/db/schema';
import { getDashboardBundle } from './metrics-service';
import { HEALTH_BAND_LABELS, STAGE_LABELS, ALERT_TYPE_LABELS } from '@/lib/constants';

export type Dataset = 'alunos' | 'alertas' | 'pesquisas' | 'indicadores' | 'cursos';

export interface Sheet {
  name: string;
  columns: string[];
  rows: (string | number | null)[][];
}

const d = (v: Date | null | undefined) => (v ? v.toISOString().slice(0, 10) : '');

export async function buildDataset(dataset: Dataset): Promise<Sheet> {
  if (dataset === 'alunos') {
    const rows = await db
      .select({ s: students, owner: users.name })
      .from(students)
      .leftJoin(users, eq(students.ownerId, users.id))
      .orderBy(students.name);
    return {
      name: 'Alunos',
      columns: [
        'Código', 'Nome', 'E-mail', 'Telefone', 'Cidade', 'UF', 'Origem', 'Matrícula',
        'Etapa', 'Health Score', 'Faixa', 'Risco de evasão (%)', 'Progresso (%)',
        'Onboarding (%)', 'Dias sem acesso', 'Horas estudadas', 'NPS', 'CSAT',
        'Situação financeira', 'LTV', 'Ticket mensal', 'Responsável',
      ],
      rows: rows.map(({ s, owner }) => [
        s.code, s.name, s.email, s.phone, s.city, s.state, s.origin, d(s.enrolledAt),
        STAGE_LABELS[s.stage], s.healthScore, HEALTH_BAND_LABELS[s.healthBand], s.churnRisk,
        Math.round(s.progressPercent), Math.round(s.onboardingPercent), s.daysWithoutAccess,
        s.studiedHours, s.npsLast, s.csatLast, s.paymentStatus, Number(s.ltv), Number(s.mrr),
        owner ?? '',
      ]),
    };
  }

  if (dataset === 'alertas') {
    const rows = await db
      .select({ a: alerts, name: students.name, code: students.code })
      .from(alerts)
      .innerJoin(students, eq(alerts.studentId, students.id))
      .orderBy(desc(alerts.createdAt))
      .limit(5000);
    return {
      name: 'Alertas',
      columns: ['Aluno', 'Código', 'Tipo', 'Severidade', 'Status', 'Título', 'Descrição', 'Criado em', 'Resolvido em'],
      rows: rows.map(({ a, name, code }) => [
        name, code, ALERT_TYPE_LABELS[a.type] ?? a.type, a.severity, a.status, a.title,
        a.description, d(a.createdAt), d(a.resolvedAt),
      ]),
    };
  }

  if (dataset === 'pesquisas') {
    const rows = await db
      .select({ v: surveyResponses, name: students.name, code: students.code })
      .from(surveyResponses)
      .innerJoin(students, eq(surveyResponses.studentId, students.id))
      .orderBy(desc(surveyResponses.createdAt))
      .limit(5000);
    return {
      name: 'Pesquisas',
      columns: ['Aluno', 'Código', 'Tipo', 'Gatilho', 'Status', 'Nota', 'Classificação', 'Comentário', 'Enviada em', 'Respondida em'],
      rows: rows.map(({ v, name, code }) => [
        name, code, v.type, v.trigger, v.status, v.score, v.npsClass, v.comment,
        d(v.sentAt), d(v.answeredAt),
      ]),
    };
  }

  if (dataset === 'cursos') {
    const bundle = await getDashboardBundle();
    return {
      name: 'Cursos',
      columns: ['Curso', 'Categoria', 'Alunos', 'Progresso médio (%)', 'Conclusão (%)', 'Concluídos', 'Cancelados', 'Health médio', 'Receita'],
      rows: bundle.courses.map((c) => [
        c.course, c.category, c.alunos, c.progresso, c.conclusao, c.concluidos, c.cancelados,
        c.health, c.receita,
      ]),
    };
  }

  const bundle = await getDashboardBundle();
  const m = bundle.metrics;
  return {
    name: 'Indicadores',
    columns: ['Indicador', 'Valor'],
    rows: [
      ['Total de alunos', m.totalStudents],
      ['Alunos ativos', m.activeStudents],
      ['Alunos em risco', m.atRiskStudents],
      ['Health Score médio', m.avgHealthScore],
      ['Risco médio de evasão (%)', m.avgChurnRisk],
      ['NPS', m.nps],
      ['Respostas de NPS', m.npsTotal],
      ['CSAT médio', m.csat],
      ['Respostas de CSAT', m.csatTotal],
      ['Taxa de conclusão (%)', m.completionRate],
      ['Churn (%)', m.churnRate],
      ['Retenção (%)', m.retentionRate],
      ['Tempo médio de resposta (min)', m.avgResponseMinutes],
      ['Receita por aluno (R$)', m.revenuePerStudent],
      ['Receita recorrente — MRR (R$)', m.mrr],
      ['Receita total (R$)', m.totalRevenue],
      ['LTV médio (R$)', m.ltv],
      ['Certificados emitidos', m.certificatesIssued],
      ['Onboarding médio (%)', m.avgOnboarding],
      ['Progresso médio (%)', m.avgProgress],
      ['Alertas abertos', m.openAlerts],
      ['Alertas críticos', m.criticalAlerts],
      ['Tarefas em atraso', m.overdueTasks],
    ],
  };
}

export function toCsv(sheet: Sheet) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Ponto e vírgula + BOM: abre corretamente no Excel em português.
  return '﻿' + [sheet.columns, ...sheet.rows].map((r) => r.map(esc).join(';')).join('\n');
}

export async function toXlsx(sheets: Sheet[]) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CSCX — Escola Instructiva';
  wb.created = new Date();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);
    ws.addRow(sheet.columns);
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D43F5' } };
    ws.getRow(1).alignment = { vertical: 'middle' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((col, i) => {
      const header = sheet.columns[i] ?? '';
      const max = sheet.rows.reduce(
        (m, r) => Math.max(m, String(r[i] ?? '').length),
        header.length,
      );
      col.width = Math.min(46, Math.max(12, max + 2));
    });
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function powerBiPayload() {
  const bundle = await getDashboardBundle();
  return {
    generatedAt: new Date().toISOString(),
    source: 'CSCX — Escola Instructiva',
    metrics: bundle.metrics,
    evolucaoMensal: bundle.evolution,
    funilJornada: bundle.funnel,
    npsMensal: bundle.npsTrend,
    cursos: bundle.courses,
    engajamentoDiario: bundle.engagement,
    healthMensal: bundle.healthTrend,
    csat: bundle.csat,
  };
}
