/**
 * Preparação do banco na primeira subida.
 *
 * Roda a cada start e é idempotente:
 *  1. confere se as tabelas existem;
 *  2. cria o usuário administrador se ainda não houver nenhum usuário;
 *  3. garante a configuração do Health Score e as automações padrão;
 *  4. se SEED_DEMO=1 e não houver alunos, popula a base de demonstração.
 *
 * Credenciais do administrador vêm de ADMIN_EMAIL e ADMIN_PASSWORD.
 */
import { hash } from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db, client } from '../src/db';
import { healthScoreConfig, integrations, users } from '../src/db/schema';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS } from '../src/lib/health-score';
import { INTEGRATION_CATALOG } from '../src/lib/constants';
import { ensureDefaultAutomations } from '../src/server/automation-service';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin@escolainstructiva.com.br').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'cscx2026';
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Administrador';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠  DATABASE_URL ausente — bootstrap ignorado.');
    return;
  }

  // 1. As tabelas existem?
  const check = await db.execute(
    sql`select to_regclass('public.users') is not null as existe`,
  );
  const existe = (check as unknown as { existe: boolean }[])[0]?.existe;
  if (!existe) {
    console.error('✗ A tabela "users" não existe. O schema não foi aplicado no banco.');
    console.error('  Rode "npm run db:push -- --force" com a DATABASE_URL correta.');
    return;
  }

  // 2. Administrador
  const [{ total }] = (await db.execute(
    sql`select count(*)::int as total from users`,
  )) as unknown as { total: number }[];

  if (Number(total) === 0) {
    await db.insert(users).values({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash: await hash(ADMIN_PASSWORD, 10),
      role: 'ADMIN',
      avatarColor: '#e85806',
    });
    console.log(`✓ Administrador criado: ${ADMIN_EMAIL}`);
    console.log('  Troque a senha no primeiro acesso, em Equipe.');
  }

  // 3. Configuração e catálogos padrão
  await db
    .insert(healthScoreConfig)
    .values({ id: 'default', weights: DEFAULT_WEIGHTS, thresholds: DEFAULT_THRESHOLDS })
    .onConflictDoNothing();

  const [{ n }] = (await db.execute(
    sql`select count(*)::int as n from integrations`,
  )) as unknown as { n: number }[];
  if (Number(n) === 0) {
    await db.insert(integrations).values(
      INTEGRATION_CATALOG.map((i) => ({
        kind: i.kind as never,
        name: i.name,
        status: 'NAO_CONFIGURADA' as const,
        config: { envKeys: i.envKeys, category: i.category, description: i.description } as never,
      })),
    );
  }

  await ensureDefaultAutomations();

  // 4. Base de demonstração (opcional)
  if (process.env.SEED_DEMO === '1') {
    const [{ alunos }] = (await db.execute(
      sql`select count(*)::int as alunos from students`,
    )) as unknown as { alunos: number }[];
    if (Number(alunos) === 0) {
      console.log('▸ SEED_DEMO=1 e base vazia — populando dados de demonstração…');
      const { seedDemoData } = await import('../src/server/demo-seed');
      const r = await seedDemoData({ reset: true });
      console.log(`✓ ${r.alunos} alunos de demonstração criados.`);
      return;
    }
  }

  console.log('✓ Banco pronto.');
}

main()
  .catch((err) => {
    console.error('✗ Bootstrap falhou:', err instanceof Error ? err.message : err);
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
