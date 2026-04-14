// src/services/notification.service.js
const prisma = require('../config/db');

const notify = async (userId, { type, title, body, data = null }, io = null) => {
  const notif = await prisma.notification.create({
    data: { userId, type, title, body, data: data ? JSON.stringify(data) : null },
  });
  if (io) {
    io.to(`user:${userId}`).emit('notification', {
      id: notif.id, type, title, body, data, createdAt: notif.createdAt,
    });
  }
  return notif;
};

module.exports = { notify };
