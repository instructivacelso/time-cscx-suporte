import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export const dynamic = 'force-dynamic';

/**
 * Diagnóstico do CSCX — aberto de propósito e sem expor segredo nenhum.
 * Responde rápido: a variável está preenchida? o banco atendeu? o schema foi
 * aplicado? já existe usuário para entrar?
 */

/** Descreve a DATABASE_URL sem revelar usuário e senha. */
function inspecionarUrl(raw: string | undefined) {
  if (!raw) {
    return {
      definida: false,
      problema: 'DATABASE_URL não está definida nas variáveis do serviço.',
    };
  }

  // Referência do Railway que não foi resolvida — o nome do serviço não bate.
  if (raw.includes('${{') || raw.includes('${')) {
    return {
      definida: true,
      problema:
        'A variável ficou com o texto da referência em vez do valor. O nome do serviço dentro de ${{ }} não confere com o nome do banco no projeto — confira se é Postgres mesmo.',
      valorBruto: raw.slice(0, 60),
    };
  }

  try {
    const u = new URL(raw);
    const interno = u.hostname.endsWith('.railway.internal');
    return {
      definida: true,
      protocolo: u.protocol.replace(':', ''),
      host: u.hostname,
      porta: u.port || '5432',
      banco: u.pathname.replace('/', '') || '(não informado)',
      usuario: u.username ? `${u.username.slice(0, 2)}***` : '(não informado)',
      senhaPreenchida: Boolean(u.password),
      rede: interno ? 'privada do Railway' : 'pública',
      tls: interno ? 'desligado (rede interna)' : 'exigido',
    };
  } catch {
    return {
      definida: true,
      problema: 'A DATABASE_URL não parece uma URL válida de PostgreSQL.',
      valorBruto: raw.slice(0, 40),
    };
  }
}

export async function GET() {
  const started = Date.now();
  const conexao = inspecionarUrl(process.env.DATABASE_URL);

  const relatorio: Record<string, unknown> = {
    app: 'CSCX — Escola Instructiva',
    horario: new Date().toISOString(),
    variaveis: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
      APP_URL: process.env.APP_URL ?? null,
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    },
    conexao,
  };

  if ('problema' in conexao) {
    return NextResponse.json({ ...relatorio, status: 'erro' }, { status: 503 });
  }

  try {
    const tabelas = (await db.execute(sql`
      select
        to_regclass('public.users')    is not null as users,
        to_regclass('public.students') is not null as students
    `)) as unknown as { users: boolean; students: boolean }[];

    if (!tabelas[0]?.users || !tabelas[0]?.students) {
      return NextResponse.json(
        {
          ...relatorio,
          status: 'erro',
          banco: 'conectado',
          schema: 'as tabelas não existem — reinicie o serviço para aplicar o schema',
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
    const msg = err instanceof Error ? err.message : String(err);
    const codigo = (err as { code?: string })?.code;

    const explicacao =
      codigo === 'ENOTFOUND'
        ? 'O endereço do banco não foi encontrado. Se o host termina em .railway.internal, o banco precisa estar no MESMO projeto e ambiente da aplicação.'
        : codigo === 'ECONNREFUSED'
          ? 'O banco recusou a conexão. Confira se o serviço do PostgreSQL está rodando e se a porta está correta.'
          : codigo === 'ETIMEDOUT' || codigo === 'CONNECT_TIMEOUT'
            ? 'A conexão expirou. Costuma ser rede privada indisponível ou host/porta errados.'
            : /password|autentic|SASL/i.test(msg)
              ? 'Usuário ou senha do banco não conferem. Refaça a referência da DATABASE_URL.'
              : /SSL|TLS/i.test(msg)
                ? 'Problema de TLS. Em endereço público o TLS é exigido; na rede interna, não.'
                : undefined;

    return NextResponse.json(
      {
        ...relatorio,
        status: 'erro',
        banco: 'falha ao conectar',
        codigo: codigo ?? null,
        detalhe: msg,
        explicacao,
      },
      { status: 503 },
    );
  }
}
