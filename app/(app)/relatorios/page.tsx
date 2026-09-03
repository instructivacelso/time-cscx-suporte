import Link from 'next/link';
import { Download, FileSpreadsheet, FileText, Printer, Table2 } from 'lucide-react';
import { Card, KpiCard, PageHeader, SectionTitle } from '@/components/ui';
import { CourseChart, MonthlyEvolutionChart, NpsTrendChart } from '@/components/charts';
import { getDashboardBundle } from '@/server/metrics-service';
import { money, num, pct } from '@/lib/format';

export const dynamic = 'force-dynamic';

const DATASETS = [
  { key: 'indicadores', label: 'Indicadores gerenciais', desc: 'Todos os KPIs consolidados da operação.' },
  { key: 'alunos', label: 'Base de alunos', desc: 'Ficha completa com Health Score, progresso e financeiro.' },
  { key: 'cursos', label: 'Desempenho por curso', desc: 'Volume, conclusão, evasão e receita por curso.' },
  { key: 'alertas', label: 'Alertas', desc: 'Histórico completo de alertas e tratativas.' },
  { key: 'pesquisas', label: 'NPS e CSAT', desc: 'Todas as respostas com notas e comentários.' },
];

export default async function ReportsPage() {
  const bundle = await getDashboardBundle();
  const m = bundle.metrics;

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Exportação em CSV, Excel, PDF e feed para Power BI."
        actions={
          <>
            <a href="/api/export" className="btn-primary">
              <Download className="h-4 w-4" /> Pacote completo (.xlsx)
            </a>
            <Link href="/relatorios/imprimir" className="btn-ghost" target="_blank">
              <Printer className="h-4 w-4" /> Versão para PDF
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Alunos" value={num(m.totalStudents)} />
        <KpiCard label="Retenção" value={pct(m.retentionRate, 1)} accent="green" />
        <KpiCard label="Churn" value={pct(m.churnRate, 1)} accent="red" />
        <KpiCard label="NPS" value={m.nps} accent="brand" />
        <KpiCard label="Receita total" value={money(m.totalRevenue)} accent="green" />
        <KpiCard label="LTV médio" value={money(m.ltv)} accent="violet" />
      </div>

      <Card className="mt-5">
        <SectionTitle
          title="Conjuntos de dados"
          description="Cada conjunto pode ser baixado em CSV (separador ponto e vírgula, pronto para Excel em português) ou XLSX formatado."
        />
        <div className="table-wrap">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-surface-2/60">
              <tr>
                <th className="th">Relatório</th>
                <th className="th">Conteúdo</th>
                <th className="th">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {DATASETS.map((d) => (
                <tr key={d.key} className="row-hover">
                  <td className="td font-medium text-ink-900">{d.label}</td>
                  <td className="td text-ink-600">{d.desc}</td>
                  <td className="td">
                    <div className="flex gap-2">
                      <a href={`/api/export/${d.key}?format=csv`} className="btn-ghost px-2.5 py-1 text-xs">
                        <Table2 className="h-3.5 w-3.5" /> CSV
                      </a>
                      <a href={`/api/export/${d.key}?format=xlsx`} className="btn-ghost px-2.5 py-1 text-xs">
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle title="Evolução mensal" />
          <MonthlyEvolutionChart data={bundle.evolution} />
        </Card>
        <Card>
          <SectionTitle title="NPS mensal" />
          <NpsTrendChart data={bundle.npsTrend} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle title="Desempenho por curso" />
          <CourseChart data={bundle.courses} />
        </Card>

        <Card>
          <SectionTitle title="Power BI" description="Feed REST em JSON para atualizar o painel da diretoria." />
          <ol className="space-y-2 text-xs text-ink-600">
            <li>
              1. No Power BI Desktop: <strong>Obter dados → Web → Avançado</strong>.
            </li>
            <li>
              2. URL:{' '}
              <code className="rounded bg-surface-3 px-1.5 py-0.5">
                {'{APP_URL}'}/api/powerbi
              </code>
            </li>
            <li>
              3. Cabeçalho: <code className="rounded bg-surface-3 px-1.5 py-0.5">x-api-key</code> com o
              valor da variável <code className="rounded bg-surface-3 px-1.5 py-0.5">POWERBI_API_KEY</code>.
            </li>
            <li>4. Atualização agendada: recomendo de hora em hora.</li>
          </ol>
          <a href="/api/powerbi" target="_blank" className="btn-ghost mt-3 w-full">
            <FileText className="h-4 w-4" /> Visualizar o JSON
          </a>
        </Card>
      </div>
    </>
  );
}
