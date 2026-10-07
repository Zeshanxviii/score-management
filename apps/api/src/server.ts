import { createApp } from './app';
import { env } from './config';
import { logger } from './logger';
import { closePool, pingDb } from './db/pool';

async function main() {
  await pingDb(); // fail fast if the database is unreachable
  const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening'));
  server.keepAliveTimeout = 65_000; // above typical load-balancer idle timeouts
  server.headersTimeout = 66_000;

  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info({ signal }, 'Shutting down');
    const force = setTimeout(() => { logger.error('Forced exit'); process.exit(1); }, 10_000);
    force.unref();
    server.close(async () => {
      await closePool().catch(() => undefined);
      process.exit(0);
    });
    server.closeIdleConnections?.();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled rejection'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
