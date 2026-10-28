import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';

// Prisma config runs before the app bootstrap, so we load .env explicitly
config();

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
