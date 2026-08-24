module.exports = {
  apps: [
    {
      name: 'seznik-backend',
      script: 'dist/server.js',
      // Was 1 (single instance, single CPU core, no matter how big the box). 'max' + cluster mode
      // makes PM2 fork one worker per detected CPU core, load-balanced by PM2's built-in round-robin
      // — required to actually use all available cores under real concurrency. Each worker gets its
      // own PrismaClient/connection pool (see db.ts + DATABASE_URL's connection_limit in .env), so
      // re-tune connection_limit if you pin `instances` to a specific number instead of 'max'.
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
