/**
 * Popula a base de demonstração pela linha de comando.
 *
 *   npm run db:seed     # popula (falha se já houver alunos)
 *   npm run db:reset    # apaga tudo e popula de novo
 */
import 'dotenv/config';
import { client } from '../src/db';
import { seedDemoData } from '../src/server/demo-seed';

seedDemoData({ reset: process.argv.includes('--reset') })
  .then((r) => {
    console.log(`\n   ${r.alunos} alunos, ${r.cursos} cursos, ${r.usuarios} usuários`);
    console.log(`   Login:  ${r.adminEmail}`);
    console.log(`   Senha:  ${r.senha}`);
  })
  .catch((err) => {
    console.error('✗', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
