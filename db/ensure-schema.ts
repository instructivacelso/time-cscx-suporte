/**
 * Rede de segurança do schema.
 *
 * O `drizzle-kit push` compara o schema do código com o banco e, num banco que
 * já tem dados, ele às vezes gera comandos que o PostgreSQL recusa — por
 * exemplo tentar remover o NOT NULL de uma coluna que é chave primária
 * (`column "id" is in a primary key`, código 42P16). Quando isso acontece o
 * push **para no primeiro erro**, e tudo o que vinha depois — inclusive tabelas
 * novas — não é criado.
 *
 * Este arquivo repõe, com SQL idempotente, o que o push pode ter deixado para
 * trás. Roda a cada subida, é seguro repetir e nunca apaga nada.
 */
import { sql } from 'drizzle-orm';
import { db } from './index';

const COMANDOS = [
  // Registro bruto dos webhooks (Cademí e futuros gateways).
  sql`
    create table if not exists webhook_events (
      id           text primary key default gen_random_uuid()::text,
      source       text not null,
      event_type   text,
      email        text,
      student_id   text references students(id) on delete set null,
      status       text not null default 'RECEBIDO',
      message      text,
      payload      jsonb not null,
      created_at   timestamptz not null default now()
    )
  `,
  sql`create index if not exists webhook_source_idx   on webhook_events (source)`,
  sql`create index if not exists webhook_received_idx on webhook_events (created_at)`,

  // Scripts de mensagem da equipe.
  sql`
    create table if not exists message_scripts (
      id            text primary key default gen_random_uuid()::text,
      title         text not null,
      channel       text not null default 'WHATSAPP',
      situation     text not null default 'GERAL',
      subject       text,
      content       text not null,
      "order"       integer not null default 0,
      active        boolean not null default true,
      created_by_id text references users(id) on delete set null,
      created_at    timestamptz not null default now(),
      updated_at    timestamptz not null default now()
    )
  `,
  sql`create index if not exists scripts_channel_idx   on message_scripts (channel)`,
  sql`create index if not exists scripts_situation_idx on message_scripts (situation)`,
];

export async function ensureSchema() {
  let falhas = 0;

  for (const comando of COMANDOS) {
    try {
      await db.execute(comando);
    } catch (err) {
      falhas += 1;
      console.warn('⚠  ensure-schema:', err instanceof Error ? err.message : err);
    }
  }

  if (falhas === 0) console.log('✓ Schema conferido.');
  return falhas === 0;
}
