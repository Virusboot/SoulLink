// src/config/redis.js
const Redis = require('ioredis');
let redis = null;

const getRedis = () => {
  if (redis) return redis;
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  redis.on('connect', () => console.log('[Redis] Connected'));
  redis.on('error',   (e) => console.warn('[Redis] Not available:', e.message));
  return redis;
};

const KEYS = {
  strangerQueue:   'stranger:queue',
  strangerSession: (uid) => `stranger:session:${uid}`,
};

module.exports = { getRedis, KEYS };
