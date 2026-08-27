/**
 * Inicialização do CSCX em produção (Railway, Docker ou servidor próprio).
 *
 * 1. Aplica o schema no PostgreSQL (drizzle-kit push) — idempotente.
 * 2. Prepara a base: cria o administrador na primeira subida, garante a
 *    configuração do Health Score, as integrações e as automações padrão.
 * 3. Sobe o Next.js na porta informada pela plataforma.
 *
 * Nenhum passo aborta a subida: falhas são registradas no log e o servidor
 * sobe assim mesmo, o que é bem mais fácil de diagnosticar do que um contêiner
 * em ciclo de reinício.
 */
import { spawn } from 'node:child_process';

const PORT = process.env.PORT ?? '3000';
const bin = (name) => `./node_modules/.bin/${name}`;

function run(command, args, label) {
  return new Promise((resolve) => {
    console.log(`\n▸ ${label}`);
    const child = spawn(command, args, { stdio: 'inherit', env: process.env, shell: false });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (err) => {
      console.error(`✗ ${label} falhou ao iniciar: ${err.message}`);
      resolve(1);
    });
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn(
      '⚠  DATABASE_URL não definida. Adicione o PostgreSQL ao projeto e configure a variável.',
    );
  } else {
    const push = await run(bin('drizzle-kit'), ['push', '--force'], 'Aplicando o schema no banco');
    if (push !== 0) {
      console.warn(`⚠  drizzle-kit push terminou com código ${push}. Confira a DATABASE_URL.`);
    }

    const boot = await run(bin('tsx'), ['scripts/bootstrap.ts'], 'Preparando a base');
    if (boot !== 0) console.warn(`⚠  Bootstrap terminou com código ${boot}.`);
  }

  if (!process.env.AUTH_SECRET) {
    console.warn(
      '⚠  AUTH_SECRET não definida. Gere uma com "openssl rand -base64 32" e configure nas variáveis.',
    );
  }

  console.log(`\n▸ Subindo o CSCX na porta ${PORT}`);
  const server = spawn(bin('next'), ['start', '-H', '0.0.0.0', '-p', PORT], {
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });

  const stop = (signal) => () => server.kill(signal);
  process.on('SIGTERM', stop('SIGTERM'));
  process.on('SIGINT', stop('SIGINT'));

  server.on('close', (code) => process.exit(code ?? 0));
}

main();
