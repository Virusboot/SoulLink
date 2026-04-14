// src/index.js
require('dotenv').config();
const http   = require('http');
const app    = require('./app');
const logger = require('./config/logger');
const prisma = require('./config/db');
const { initSocket } = require('./services/socket.service');
const { getRedis }   = require('./config/redis');

const PORT = process.env.PORT || 5000;

async function start() {
  const server = http.createServer(app);
  initSocket(server);

  // Redis optional
  try {
    const r = getRedis();
    await r.connect();
  } catch {
    logger.warn('[Redis] Not available — using memory fallback for stranger queue');
  }

  server.listen(PORT, () => {
    logger.info(`\n💜 SoulLink API v3.1 on port ${PORT}`);
    logger.info(`📦 Mode:  ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🎮 Agora: ${process.env.AGORA_APP_ID ? '✅ configured' : '⚠️  not set'}`);
    logger.info(`🔴 Redis: ${process.env.REDIS_URL   ? '✅ configured' : '⚠️  memory fallback'}`);
    logger.info(`🔗 Health: http://localhost:${PORT}/api/health\n`);
  });

  const shutdown = async (sig) => {
    logger.info(`[${sig}] Shutting down...`);
    await prisma.$disconnect().catch(() => {});
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('uncaughtException',  err => logger.error('Uncaught:', err));
  process.on('unhandledRejection', err => logger.error('Unhandled:', err));
}

start().catch(err => { console.error('Startup failed:', err); process.exit(1); });
