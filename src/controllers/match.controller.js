// src/controllers/match.controller.js
const prisma     = require('../config/db');
const { notify } = require('../services/notification.service');
const { getIO }  = require('../services/socket.service');

exports.likeUser = async (req, res, next) => {
  try {
    const senderId = req.user.id, receiverId = req.params.id;
    if (senderId === receiverId) return res.status(400).json({ success: false, message: 'Cannot like yourself' });
    await prisma.match.upsert({
      where:  { senderId_receiverId: { senderId, receiverId } },
      create: { senderId, receiverId, status: 'PENDING' },
      update: { status: 'PENDING' },
    });
    const reverse = await prisma.match.findUnique({ where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } } });
    let isMatch = false;
    if (reverse?.status === 'PENDING') {
      await prisma.match.updateMany({ where: { OR: [{ senderId, receiverId }, { senderId: receiverId, receiverId: senderId }] }, data: { status: 'MATCHED' } });
      const match = await prisma.match.findUnique({ where: { senderId_receiverId: { senderId, receiverId } } });
      await prisma.conversation.upsert({ where: { matchId: match.id }, create: { matchId: match.id }, update: {} });
      isMatch = true;
      const io = getIO();
      await notify(senderId,   { type: 'match', title: "It's a Match! 💜", body: "You matched! Start chatting." }, io);
      await notify(receiverId, { type: 'match', title: "It's a Match! 💜", body: "You matched! Start chatting." }, io);
    } else {
      await notify(receiverId, { type: 'like', title: 'Someone liked you! 💜', body: `${req.user.name || 'Someone'} liked your profile` }, getIO());
    }
    res.json({ success: true, isMatch });
  } catch (err) { next(err); }
};

exports.passUser = async (req, res, next) => {
  try {
    await prisma.match.upsert({
      where:  { senderId_receiverId: { senderId: req.user.id, receiverId: req.params.id } },
      create: { senderId: req.user.id, receiverId: req.params.id, status: 'PASSED' },
      update: { status: 'PASSED' },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.getMatches = async (req, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      where: { status: 'MATCHED', OR: [{ senderId: req.user.id }, { receiverId: req.user.id }] },
      include: {
        sender:   { select: { id: true, name: true, avatarUrl: true, avatarInitials: true, isOnline: true, lastSeen: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true, avatarInitials: true, isOnline: true, lastSeen: true } },
        conversation: { include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const formatted = matches.map(m => ({
      matchId:        m.id,
      conversationId: m.conversation?.id,
      user:           m.senderId === req.user.id ? m.receiver : m.sender,
      lastMessage:    m.conversation?.messages[0] || null,
      createdAt:      m.createdAt,
    }));
    res.json({ success: true, matches: formatted });
  } catch (err) { next(err); }
};

exports.getLikes = async (req, res, next) => {
  try {
    const likes = await prisma.match.findMany({
      where: { receiverId: req.user.id, status: 'PENDING' },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, avatarInitials: true, age: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, likes: likes.map(l => l.sender) });
  } catch (err) { next(err); }
};
