import type { Config } from 'drizzle-kit';

const url = process.env.DATABASE_URL ?? 'postgresql://cscx:cscx@127.0.0.1:5432/cscx';

/**
 * Conexões locais e a rede interna do Railway não usam TLS.
 * Endereços públicos (proxy do Railway, Neon, Supabase…) exigem.
 */
const local =
  url.includes('localhost') ||
  url.includes('127.0.0.1') ||
  url.includes('.railway.internal') ||
  url.includes('sslmode=disable');

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url,
    ssl: local ? false : 'require',
  },
  verbose: true,
  strict: false,
} satisfies Config;
