import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// 1. Load the environment variables from your .env file
dotenv.config({
  path: '.env.local',
});

export default defineConfig({
  schema: './packages/database/src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
