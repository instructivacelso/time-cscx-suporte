import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://cscx:cscx@127.0.0.1:5432/cscx';

/**
 * Conexões locais e a rede interna do Railway não usam TLS.
 * Endereços públicos (proxy do Railway, Neon, Supabase…) exigem.
 */
const local =
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1') ||
  connectionString.includes('.railway.internal') ||
  connectionString.includes('sslmode=disable');

const globalForDb = globalThis as unknown as {
  __cscxClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__cscxClient ??
  postgres(connectionString, {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: local ? false : 'require',
  });

if (process.env.NODE_ENV !== 'production') globalForDb.__cscxClient = client;

export const db = drizzle(client, { schema });
export { schema, client };
export type Db = typeof db;
