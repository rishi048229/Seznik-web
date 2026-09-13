import app from './app';
import prisma, { warmConnectionPool } from './config/db';
import { ensureAdditiveSchema } from './utils/ensureAdditiveSchema';

const PORT = Number(process.env.PORT) || 5001;

// `tsx watch` sends SIGTERM and immediately starts the replacement process. Without an explicit
// close the listener can still hold the port when the new one boots, which fails with EADDRINUSE
// and leaves the dev server down until it's restarted by hand.
let shuttingDown = false;
let server: ReturnType<typeof app.listen> | null = null;

const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} received — closing server`);

  try {
    if (server) {
      if (typeof (server as any).closeIdleConnections === 'function') {
        (server as any).closeIdleConnections();
      }
      server.close();
    }
  } catch (err) {
    // ignore
  }

  void prisma.$disconnect().finally(() => {
    process.exit(0);
  });

  setTimeout(() => process.exit(0), 500).unref();
};


process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// A transient database outage shouldn't be able to take the API down. Node's default is to exit on
// an unhandled rejection, which previously turned a dropped connection into a dead dev server.
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason instanceof Error ? reason.stack : reason);
});
process.on('uncaughtException', (error) => {
  console.error('[server] uncaught exception:', error?.stack ?? error);
});

// Ensure additive DB schema columns exist before accepting traffic, but don't block startup on failure.
ensureAdditiveSchema()
  .then(() => {
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT} (0.0.0.0)`);
      void warmConnectionPool();
    });
  })
  .catch((err) => {
    console.error('Failed to ensure additive database columns:', err);
    // Still listen so login/health keep working; settings routes retry ensure on demand.
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT} (0.0.0.0— schema ensure failed)`);
      void warmConnectionPool();
    });
  });
