// src/controllers/notification.controller.js
const prisma = require('../config/db');

exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1 } = req.query;
    const limit = 20, skip = (parseInt(page) - 1) * limit;
    const [notifications, total, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.notification.count({ where: { userId: req.user.id } }),
      prisma.notification.count({ where: { userId: req.user.id, read: false } }),
    ]);
    res.json({ success: true, notifications, total, unread, page: parseInt(page) });
  } catch (err) { next(err); }
};

exports.markRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { read: true } });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    await prisma.notification.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.clearAll = async (req, res, next) => {
  try {
    await prisma.notification.deleteMany({ where: { userId: req.user.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
};
