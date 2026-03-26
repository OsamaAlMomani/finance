import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DRIZZLE_DB_PATH || './tmp/drizzle-dev.db';

export default defineConfig({
  out: './drizzle',
  schema: './src/services/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: databaseUrl
  }
});

