// src/services/socket.service.js
const { Server }  = require('socket.io');
const jwt         = require('jsonwebtoken');
const prisma      = require('../config/db');
const stranger    = require('./stranger.service');
const gameSvc     = require('./game.service');
const { notify }  = require('./notification.service');
const logger      = require('../config/logger');

let io = null;
const userSockets = new Map();

exports.initSocket = (server) => {
  io = new Server(server, {
    cors: { origin: (process.env.ALLOWED_ORIGINS || '*').split(','), credentials: true },
    pingTimeout:  60000,
    pingInterval: 25000,
    transports:   ['websocket', 'polling'],
  });

  // ── Auth ─────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token'));
      jwt.verify(token, process.env.JWT_SECRET);
      const session = await prisma.session.findUnique({
        where: { token }, include: { user: true },
      });
      if (!session || session.expiresAt < new Date()) return next(new Error('Session expired'));
      socket.userId = session.user.id;
      socket.user   = session.user;
      next();
    } catch { next(new Error('Auth failed')); }
  });

  io.on('connection', async (socket) => {
    const uid = socket.userId;
    logger.info(`[Socket] ${socket.user?.name || uid} connected`);

    if (!userSockets.has(uid)) userSockets.set(uid, new Set());
    userSockets.get(uid).add(socket.id);

    await prisma.user.update({ where: { id: uid }, data: { isOnline: true, lastSeen: new Date() } }).catch(() => {});
    socket.join(`user:${uid}`);

    // ════════════════════════════════════════════════════════
    // STRANGER MATCHING
    // ════════════════════════════════════════════════════════
    socket.on('find_stranger', async () => {
      try {
        await stranger.leaveQueue(uid);
        const result = await stranger.joinQueue(uid);
        if (result.matched) {
          const payload = { partnerId: result.partnerId, channelName: result.channelId, callId: result.callId };
          io.to(`user:${uid}`).emit('match_found', payload);
          io.to(`user:${result.partnerId}`).emit('match_found', payload);
          logger.info(`[Stranger] ${uid} ↔ ${result.partnerId} | ch: ${result.channelId}`);
          await prisma.call.create({
            data: { callerId: uid, receiverId: result.partnerId, channelId: result.channelId, type: 'STRANGER', status: 'INITIATED' },
          }).catch(() => {});
        } else {
          socket.emit('searching', { queuePosition: await stranger.queueLength() });
        }
      } catch (err) {
        logger.error('[find_stranger]', err.message);
        socket.emit('match_error', { message: 'Matching failed, try again' });
      }
    });

    socket.on('stop_search', async () => {
      await stranger.leaveQueue(uid).catch(() => {});
      socket.emit('search_stopped');
    });

    socket.on('call_start', async ({ channelName, partnerId }) => {
      try {
        await prisma.call.updateMany({
          where: { channelId: channelName, status: 'INITIATED' },
          data:  { status: 'ACTIVE', startedAt: new Date() },
        });
        if (partnerId) io.to(`user:${partnerId}`).emit('partner_joined', { userId: uid, name: socket.user?.name });
      } catch {}
    });

    socket.on('user_skipped', async ({ channelName, partnerId }) => {
      try {
        if (partnerId) io.to(`user:${partnerId}`).emit('partner_skipped', { userId: uid });
        await stranger.endSession(uid);
        if (channelName) {
          await prisma.call.updateMany({
            where: { channelId: channelName, status: { in: ['INITIATED', 'ACTIVE'] } },
            data:  { status: 'ENDED', endedAt: new Date() },
          }).catch(() => {});
        }
      } catch {}
    });

    socket.on('call_end', async ({ channelName, partnerId }) => {
      try {
        if (partnerId) io.to(`user:${partnerId}`).emit('call_ended', { channelName, endedBy: uid });
        await stranger.endSession(uid);
        if (channelName) {
          const call = await prisma.call.findFirst({
            where: { channelId: channelName, status: { in: ['INITIATED', 'ACTIVE'] } },
          });
          if (call) {
            const duration = call.startedAt ? Math.floor((Date.now() - call.startedAt.getTime()) / 1000) : 0;
            await prisma.call.update({ where: { id: call.id }, data: { status: 'ENDED', endedAt: new Date(), duration } });
          }
        }
      } catch {}
    });

    // ════════════════════════════════════════════════════════
    // WEBRTC (for regular match calls)
    // ════════════════════════════════════════════════════════
    socket.on('call_offer',         ({ targetUserId, offer,    callId, channelId }) => exports.emitToUser(targetUserId, 'incoming_call',  { callerId: uid, callerName: socket.user?.name, offer, callId, channelId }));
    socket.on('call_answer',        ({ targetUserId, answer,   callId })            => exports.emitToUser(targetUserId, 'call_answered',  { answer, callId }));
    socket.on('call_ice_candidate', ({ targetUserId, candidate, sdpMid, sdpMLineIndex }) => exports.emitToUser(targetUserId, 'ice_candidate', { candidate, sdpMid, sdpMLineIndex }));
    socket.on('call_reject',        ({ targetUserId, callId })                      => exports.emitToUser(targetUserId, 'call_rejected',  { callId }));

    // ════════════════════════════════════════════════════════
    // CHAT
    // ════════════════════════════════════════════════════════
    socket.on('join_conversation',  (cid) => socket.join(`conv:${cid}`));
    socket.on('leave_conversation', (cid) => socket.leave(`conv:${cid}`));
    socket.on('typing_start', ({ conversationId }) => socket.to(`conv:${conversationId}`).emit('typing_start', { userId: uid }));
    socket.on('typing_stop',  ({ conversationId }) => socket.to(`conv:${conversationId}`).emit('typing_stop',  { userId: uid }));
    socket.on('message_read', async ({ conversationId }) => {
      try {
        await prisma.message.updateMany({ where: { conversationId, NOT: { senderId: uid }, status: { not: 'READ' } }, data: { status: 'READ' } });
        socket.to(`conv:${conversationId}`).emit('messages_read', { userId: uid });
      } catch {}
    });

    // ════════════════════════════════════════════════════════
    // ROOMS
    // ════════════════════════════════════════════════════════
    socket.on('join_room',  (roomId) => { socket.join(`room:${roomId}`); socket.to(`room:${roomId}`).emit('user_joined_room', { userId: uid, name: socket.user?.name }); });
    socket.on('leave_room', (roomId) => { socket.leave(`room:${roomId}`); socket.to(`room:${roomId}`).emit('user_left_room', { userId: uid }); });
    socket.on('room_message', async ({ roomId, text }) => {
      try {
        const msg = await prisma.roomMessage.create({ data: { roomId, senderId: uid, text } });
        io.to(`room:${roomId}`).emit('room_message', { id: msg.id, roomId, senderId: uid, senderName: socket.user?.name, text, createdAt: msg.createdAt });
      } catch {}
    });

    // ════════════════════════════════════════════════════════
    // GAMES
    // ════════════════════════════════════════════════════════
    socket.on('game_create', async ({ type, targetUserId }) => {
      try {
        const game  = await gameSvc.createGame(type, [uid, targetUserId]);
        const state = JSON.parse(game.state);
        const evt   = { gameId: game.id, type, state, currentTurn: game.currentTurn };
        io.to(`user:${uid}`).emit('game_started', evt);
        io.to(`user:${targetUserId}`).emit('game_started', evt);
      } catch {}
    });
    socket.on('game_action', async ({ gameId, action, participants }) => {
      try {
        const { game, state, nextQuestion } = await gameSvc.nextTurn(gameId, uid, action, participants);
        (participants || []).forEach(pid => io.to(`user:${pid}`).emit('game_update', { gameId, state, currentTurn: game.currentTurn, nextQuestion, action, byUser: uid }));
      } catch {}
    });
    socket.on('game_end', async ({ gameId, participants }) => {
      try {
        await gameSvc.endGame(gameId);
        (participants || []).forEach(pid => io.to(`user:${pid}`).emit('game_ended', { gameId }));
      } catch {}
    });

    // ════════════════════════════════════════════════════════
    // DISCONNECT
    // ════════════════════════════════════════════════════════
    socket.on('disconnect', async () => {
      try {
        const session = await stranger.getSession(uid);
        if (session?.partnerId) io.to(`user:${session.partnerId}`).emit('partner_left', { userId: uid });
        await stranger.leaveQueue(uid).catch(() => {});
        await stranger.endSession(uid).catch(() => {});
        const sockets = userSockets.get(uid);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(uid);
            await prisma.user.update({ where: { id: uid }, data: { isOnline: false, lastSeen: new Date() } }).catch(() => {});
            logger.info(`[Socket] ${socket.user?.name || uid} offline`);
          }
        }
      } catch {}
    });
  });

  logger.info('[Socket.IO] Initialized');
  return io;
};

exports.emitToUser         = (uid, ev, data) => { if (io) io.to(`user:${uid}`).emit(ev, data); };
exports.emitToRoom         = (rid, ev, data) => { if (io) io.to(`room:${rid}`).emit(ev, data); };
exports.emitToConversation = (cid, ev, data) => { if (io) io.to(`conv:${cid}`).emit(ev, data); };
exports.getIO              = () => io;
exports.isOnline           = (uid) => userSockets.has(uid);
