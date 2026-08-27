/**
 * Inicialização do CSCX em produção (Railway, Docker ou servidor próprio).
 *
 * 1. Aplica o schema no PostgreSQL (drizzle-kit push) — idempotente.
 * 2. Sobe o Next.js na porta informada pela plataforma.
 *
 * Se o push falhar, o processo NÃO aborta: o servidor sobe assim mesmo e o
 * erro fica registrado no log, o que é bem mais fácil de diagnosticar do que
 * um contêiner em ciclo de reinício.
 */
import { spawn } from 'node:child_process';

const PORT = process.env.PORT ?? '3000';

function run(command, args, label) {
  return new Promise((resolve) => {
    console.log(`\n▸ ${label}`);
    const child = spawn(command, args, { stdio: 'inherit', env: process.env, shell: false });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (err) => {
      console.error(`✗ ${label} falhou ao iniciar:`, err.message);
      resolve(1);
    });
  });
}

const bin = (name) => `./node_modules/.bin/${name}`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn(
      '⚠  DATABASE_URL não definida. Adicione o PostgreSQL ao projeto para que o CSCX funcione.',
    );
  } else {
    const code = await run(bin('drizzle-kit'), ['push', '--force'], 'Aplicando o schema no banco');
    if (code !== 0) {
      console.warn(
        `⚠  drizzle-kit push terminou com código ${code}. O servidor vai subir mesmo assim — confira a DATABASE_URL.`,
      );
    }
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
