// src/controllers/chat.controller.js
const prisma = require('../config/db');
const { emitToConversation } = require('../services/socket.service');
const { notify } = require('../services/notification.service');
const { getIO }  = require('../services/socket.service');

exports.getConversations = async (req, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      where: { status: 'MATCHED', OR: [{ senderId: req.user.id }, { receiverId: req.user.id }], conversation: { isNot: null } },
      include: {
        sender:   { select: { id: true, name: true, avatarUrl: true, avatarInitials: true, isOnline: true, lastSeen: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true, avatarInitials: true, isOnline: true, lastSeen: true } },
        conversation: { include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const conversations = matches.map(m => ({
      conversationId: m.conversation.id,
      matchId:        m.id,
      user:           m.senderId === req.user.id ? m.receiver : m.sender,
      lastMessage:    m.conversation?.messages[0] || null,
      updatedAt:      m.conversation.updatedAt,
    }));
    res.json({ success: true, conversations });
  } catch (err) { next(err); }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { match: true } });
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (conv.match.senderId !== req.user.id && conv.match.receiverId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Access denied' });
    const [messages, total] = await Promise.all([
      prisma.message.findMany({ where: { conversationId }, include: { sender: { select: { id: true, name: true, avatarUrl: true, avatarInitials: true } } }, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit) }),
      prisma.message.count({ where: { conversationId } }),
    ]);
    res.json({ success: true, messages: messages.reverse(), pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { text, mediaUrl, mediaType } = req.body;
    if (!text && !mediaUrl) return res.status(400).json({ success: false, message: 'text or mediaUrl required' });
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { match: true } });
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (conv.match.senderId !== req.user.id && conv.match.receiverId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Access denied' });
    const message = await prisma.message.create({
      data: { conversationId, senderId: req.user.id, text: text || null, mediaUrl: mediaUrl || null, mediaType: mediaType || null, status: 'SENT' },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, avatarInitials: true } } },
    });
    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    emitToConversation(conversationId, 'new_message', message);
    const receiverId = conv.match.senderId === req.user.id ? conv.match.receiverId : conv.match.senderId;
    await notify(receiverId, { type: 'message', title: req.user.name || 'New message', body: text || '📎 Media', data: { conversationId } }, getIO());
    res.status(201).json({ success: true, message });
  } catch (err) { next(err); }
};

exports.markRead = async (req, res, next) => {
  try {
    await prisma.message.updateMany({ where: { conversationId: req.params.conversationId, NOT: { senderId: req.user.id }, status: { not: 'READ' } }, data: { status: 'READ' } });
    emitToConversation(req.params.conversationId, 'messages_read', { userId: req.user.id });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    const msg = await prisma.message.findUnique({ where: { id: req.params.messageId } });
    if (!msg) return res.status(404).json({ success: false, message: 'Not found' });
    if (msg.senderId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });
    await prisma.message.delete({ where: { id: req.params.messageId } });
    emitToConversation(msg.conversationId, 'message_deleted', { messageId: msg.id });
    res.json({ success: true });
  } catch (err) { next(err); }
};
