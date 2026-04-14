// src/controllers/room.controller.js
const prisma = require('../config/db');
const { emitToRoom } = require('../services/socket.service');

exports.getRooms = async (req, res, next) => {
  try {
    const { filter = 'live', page = 1 } = req.query;
    const limit = 20, skip = (parseInt(page) - 1) * limit;
    const where = {
      ...(filter === 'live' && { isLive: true }),
      ...(filter === 'mine' && { OR: [{ hostId: req.user.id }, { members: { some: { userId: req.user.id } } }] }),
    };
    const rooms = await prisma.room.findMany({
      where, skip, take: limit,
      include: { host: { select: { id: true, name: true, avatarUrl: true } }, members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } }, _count: { select: { members: true } } },
      orderBy: [{ isLive: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, rooms });
  } catch (err) { next(err); }
};

exports.createRoom = async (req, res, next) => {
  try {
    const { title, subtitle, tags = [], isPrivate = false, password, maxMembers = 50 } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });
    const room = await prisma.room.create({
      data: { title, subtitle: subtitle || null, tags: JSON.stringify(tags), isPrivate, password: password || null, maxMembers: parseInt(maxMembers), hostId: req.user.id, isLive: true, members: { create: { userId: req.user.id, role: 'HOST' } } },
      include: { host: { select: { id: true, name: true, avatarUrl: true } }, members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } },
    });
    res.status(201).json({ success: true, room });
  } catch (err) { next(err); }
};

exports.getRoom = async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: { host: { select: { id: true, name: true, avatarUrl: true } }, members: { include: { user: { select: { id: true, name: true, avatarUrl: true, avatarInitials: true } } } }, messages: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true, room });
  } catch (err) { next(err); }
};

exports.joinRoom = async (req, res, next) => {
  try {
    const { role = 'LISTENER', password } = req.body;
    const roomId = req.params.id;
    const room = await prisma.room.findUnique({ where: { id: roomId }, include: { _count: { select: { members: true } } } });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room._count.members >= room.maxMembers) return res.status(400).json({ success: false, message: 'Room is full' });
    if (room.isPrivate && room.password && room.password !== password) return res.status(403).json({ success: false, message: 'Wrong password' });
    await prisma.roomMember.upsert({ where: { roomId_userId: { roomId, userId: req.user.id } }, create: { roomId, userId: req.user.id, role }, update: { role } });
    const updated = await prisma.room.findUnique({ where: { id: roomId }, include: { host: { select: { id: true, name: true, avatarUrl: true } }, members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } } });
    emitToRoom(roomId, 'user_joined_room', { userId: req.user.id, name: req.user.name, role });
    res.json({ success: true, room: updated });
  } catch (err) { next(err); }
};

exports.leaveRoom = async (req, res, next) => {
  try {
    const roomId = req.params.id;
    await prisma.roomMember.deleteMany({ where: { roomId, userId: req.user.id } });
    emitToRoom(roomId, 'user_left_room', { userId: req.user.id });
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (room?.hostId === req.user.id) {
      await prisma.room.update({ where: { id: roomId }, data: { isLive: false } });
      emitToRoom(roomId, 'room_closed', { roomId });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.updateMemberRole = async (req, res, next) => {
  try {
    const { userId, role } = req.body;
    const room = await prisma.room.findUnique({ where: { id: req.params.id } });
    if (!room) return res.status(404).json({ success: false, message: 'Not found' });
    if (room.hostId !== req.user.id) return res.status(403).json({ success: false, message: 'Only host can change roles' });
    await prisma.roomMember.update({ where: { roomId_userId: { roomId: req.params.id, userId } }, data: { role } });
    emitToRoom(req.params.id, 'member_role_updated', { userId, role });
    res.json({ success: true });
  } catch (err) { next(err); }
};
