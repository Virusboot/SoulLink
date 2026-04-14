// src/services/stranger.service.js
const { getRedis, KEYS } = require('../config/redis');
const { v4: uuidv4 }     = require('uuid');

// Memory fallback when Redis unavailable
const memQueue    = [];
const memSessions = new Map();

const _redisOk = async () => {
  try { await getRedis().ping(); return true; } catch { return false; }
};

const joinQueue = async (userId) => {
  if (await _redisOk()) return _redisJoin(userId);
  return _memJoin(userId);
};

const _redisJoin = async (userId) => {
  const r = getRedis();
  await r.lrem(KEYS.strangerQueue, 0, userId);
  await r.del(KEYS.strangerSession(userId));
  const partnerId = await r.lpop(KEYS.strangerQueue);
  if (partnerId && partnerId !== userId) {
    const callId = `call_${uuidv4()}`;
    const channelId = `ch_${uuidv4().replace(/-/g,'').substring(0,16)}`;
    await r.setex(KEYS.strangerSession(userId),    3600, JSON.stringify({ partnerId, callId, channelId }));
    await r.setex(KEYS.strangerSession(partnerId), 3600, JSON.stringify({ partnerId: userId, callId, channelId }));
    return { matched: true, partnerId, callId, channelId };
  }
  await r.rpush(KEYS.strangerQueue, userId);
  return { matched: false };
};

const _memJoin = (userId) => {
  const i = memQueue.indexOf(userId);
  if (i !== -1) memQueue.splice(i, 1);
  memSessions.delete(userId);
  const pi = memQueue.findIndex(id => id !== userId);
  if (pi !== -1) {
    const partnerId = memQueue.splice(pi, 1)[0];
    const callId    = `call_${uuidv4()}`;
    const channelId = `ch_${uuidv4().replace(/-/g,'').substring(0,16)}`;
    memSessions.set(userId,    { partnerId, callId, channelId });
    memSessions.set(partnerId, { partnerId: userId, callId, channelId });
    return { matched: true, partnerId, callId, channelId };
  }
  memQueue.push(userId);
  return { matched: false };
};

const leaveQueue = async (userId) => {
  if (await _redisOk()) {
    await getRedis().lrem(KEYS.strangerQueue, 0, userId);
    await getRedis().del(KEYS.strangerSession(userId));
  } else {
    const i = memQueue.indexOf(userId);
    if (i !== -1) memQueue.splice(i, 1);
    memSessions.delete(userId);
  }
};

const getSession = async (userId) => {
  if (await _redisOk()) {
    const raw = await getRedis().get(KEYS.strangerSession(userId));
    return raw ? JSON.parse(raw) : null;
  }
  return memSessions.get(userId) || null;
};

const endSession = async (userId) => {
  const s = await getSession(userId);
  if (await _redisOk()) {
    const keys = [KEYS.strangerSession(userId)];
    if (s?.partnerId) keys.push(KEYS.strangerSession(s.partnerId));
    if (keys.length) await getRedis().del(...keys);
  } else {
    memSessions.delete(userId);
    if (s?.partnerId) memSessions.delete(s.partnerId);
  }
};

const queueLength = async () => {
  if (await _redisOk()) return getRedis().llen(KEYS.strangerQueue);
  return memQueue.length;
};

module.exports = { joinQueue, leaveQueue, getSession, endSession, queueLength };
