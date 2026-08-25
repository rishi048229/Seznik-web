import app from './app';
import prisma, { warmConnectionPool } from './config/db';

const PORT = Number(process.env.PORT) || 5001;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT} (0.0.0.0)`);
  void warmConnectionPool();
});

// `tsx watch` sends SIGTERM and immediately starts the replacement process. Without an explicit
// close the listener can still hold the port when the new one boots, which fails with EADDRINUSE
// and leaves the dev server down until it's restarted by hand.
let shuttingDown = false;

const shutdown = (signal: string) => {
  // A repeated signal must not restart the sequence, or the exit deadline keeps being pushed back
  // and the watcher gives up and force-kills instead.
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} received — closing server`);

  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  // server.close() waits for in-flight requests but idle keep-alive sockets would hold it open
  // until they time out on their own.
  server.closeIdleConnections();
  setTimeout(() => process.exit(0), 2000).unref();
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
