import 'dotenv/config';
import app from './app';
import { prisma } from './db';
import { startOverdueScanner } from './jobs/overdueScanner';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function bootstrap() {
  // Verify DB connection
  await prisma.$connect();
  console.log('[DB] Connected to PostgreSQL via Prisma');

  // Start scheduled jobs
  startOverdueScanner();

  // Start HTTP server
  const server = app.listen(PORT, () => {
    console.log(`[Server] LibraCMS API running on http://localhost:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}. Gracefully shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log('[Server] Shutdown complete.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
