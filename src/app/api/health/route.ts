import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export const dynamic = 'force-dynamic';

/**
 * Diagnóstico do CSCX — aberto de propósito, não devolve nenhum dado sensível.
 * Serve para responder rápido: o banco respondeu? o schema foi aplicado?
 * já existe usuário para entrar?
 */
export async function GET() {
  const started = Date.now();

  const relatorio: Record<string, unknown> = {
    app: 'CSCX — Escola Instructiva',
    horario: new Date().toISOString(),
    variaveis: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
      APP_URL: process.env.APP_URL ?? null,
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    },
  };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ...relatorio, status: 'erro', banco: 'DATABASE_URL não configurada' },
      { status: 503 },
    );
  }

  try {
    const tabelas = (await db.execute(sql`
      select
        to_regclass('public.users')    is not null as users,
        to_regclass('public.students') is not null as students,
        to_regclass('public.alerts')   is not null as alerts
    `)) as unknown as { users: boolean; students: boolean; alerts: boolean }[];

    const schemaOk = tabelas[0]?.users && tabelas[0]?.students;

    if (!schemaOk) {
      return NextResponse.json(
        {
          ...relatorio,
          status: 'erro',
          banco: 'conectado',
          schema: 'as tabelas não existem — rode "npm run db:push -- --force"',
          tabelas: tabelas[0],
        },
        { status: 503 },
      );
    }

    const contagem = (await db.execute(sql`
      select
        (select count(*)::int from users)    as usuarios,
        (select count(*)::int from students) as alunos,
        (select count(*)::int from courses)  as cursos
    `)) as unknown as { usuarios: number; alunos: number; cursos: number }[];

    const { usuarios, alunos, cursos } = contagem[0] ?? { usuarios: 0, alunos: 0, cursos: 0 };

    return NextResponse.json({
      ...relatorio,
      status: usuarios > 0 ? 'ok' : 'atencao',
      banco: 'conectado',
      schema: 'aplicado',
      registros: { usuarios, alunos, cursos },
      aviso:
        usuarios === 0
          ? 'Nenhum usuário cadastrado — ninguém consegue entrar. Reinicie o serviço para o bootstrap criar o administrador.'
          : undefined,
      tempoMs: Date.now() - started,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ...relatorio,
        status: 'erro',
        banco: 'falha ao conectar',
        detalhe: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
