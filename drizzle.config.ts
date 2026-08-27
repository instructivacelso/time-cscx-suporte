import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://cscx:cscx@127.0.0.1:5432/cscx',
  },
  verbose: true,
  strict: false,
} satisfies Config;
