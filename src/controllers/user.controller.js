// src/controllers/user.controller.js
const prisma = require('../config/db');

exports.getMyProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { interests: { include: { interest: true } } } });
    res.json({ success: true, user });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, age, bio, gender, location, avatarInitials, fcmToken, interestIds } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name           !== undefined && { name }),
        ...(age            !== undefined && { age: parseInt(age) }),
        ...(bio            !== undefined && { bio }),
        ...(gender         !== undefined && { gender }),
        ...(location       !== undefined && { location }),
        ...(avatarInitials !== undefined && { avatarInitials }),
        ...(fcmToken       !== undefined && { fcmToken }),
      },
    });
    if (Array.isArray(interestIds)) {
      await prisma.userInterest.deleteMany({ where: { userId: req.user.id } });
      if (interestIds.length) await prisma.userInterest.createMany({ data: interestIds.map(id => ({ userId: req.user.id, interestId: id })), skipDuplicates: true });
    }
    const updated = await prisma.user.findUnique({ where: { id: req.user.id }, include: { interests: { include: { interest: true } } } });
    res.json({ success: true, user: updated });
  } catch (err) { next(err); }
};

exports.discoverUsers = async (req, res, next) => {
  try {
    const { page = 1, gender, minAge, maxAge } = req.query;
    const limit = 20, skip = (parseInt(page) - 1) * limit;
    const blocked = await prisma.block.findMany({ where: { OR: [{ blockerId: req.user.id }, { blockedId: req.user.id }] } });
    const blockedIds = blocked.map(b => b.blockerId === req.user.id ? b.blockedId : b.blockerId);
    const swiped = await prisma.match.findMany({ where: { senderId: req.user.id }, select: { receiverId: true } });
    const swipedIds = swiped.map(m => m.receiverId);
    const excludeIds = [...new Set([...blockedIds, ...swipedIds, req.user.id])];
    const where = { id: { notIn: excludeIds }, name: { not: null }, ...(gender && { gender }), ...((minAge || maxAge) && { age: { ...(minAge && { gte: parseInt(minAge) }), ...(maxAge && { lte: parseInt(maxAge) }) } }) };
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take: limit, select: { id: true, name: true, age: true, bio: true, gender: true, avatarUrl: true, avatarInitials: true, location: true, soulScore: true, isOnline: true, lastSeen: true, interests: { include: { interest: true } } }, orderBy: { soulScore: 'desc' } }),
      prisma.user.count({ where }),
    ]);
    res.json({ success: true, users, pagination: { page: parseInt(page), limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

exports.getUserById = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, age: true, bio: true, gender: true, avatarUrl: true, avatarInitials: true, location: true, soulScore: true, isOnline: true, lastSeen: true, interests: { include: { interest: true } } } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) { next(err); }
};

exports.blockUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ success: false, message: 'Cannot block yourself' });
    await prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: req.user.id, blockedId: req.params.id } }, create: { blockerId: req.user.id, blockedId: req.params.id }, update: {} });
    res.json({ success: true, message: 'User blocked' });
  } catch (err) { next(err); }
};

exports.unblockUser = async (req, res, next) => {
  try {
    await prisma.block.deleteMany({ where: { blockerId: req.user.id, blockedId: req.params.id } });
    res.json({ success: true, message: 'User unblocked' });
  } catch (err) { next(err); }
};

exports.getBlockedUsers = async (req, res, next) => {
  try {
    const blocks = await prisma.block.findMany({ where: { blockerId: req.user.id }, include: { blocked: { select: { id: true, name: true, avatarUrl: true } } } });
    res.json({ success: true, blocked: blocks.map(b => b.blocked) });
  } catch (err) { next(err); }
};

exports.getAllInterests = async (req, res, next) => {
  try {
    const interests = await prisma.interest.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, interests });
  } catch (err) { next(err); }
};
