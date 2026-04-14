// src/controllers/call.controller.js
const prisma = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { notify } = require('../services/notification.service');
const { getIO }  = require('../services/socket.service');

exports.initiateCall = async (req, res, next) => {
  try {
    const { receiverId, type = 'VIDEO' } = req.body;
    if (!receiverId) return res.status(400).json({ success: false, message: 'receiverId required' });
    const channelId = `ch_${uuidv4().replace(/-/g,'').substring(0,16)}`;
    const call = await prisma.call.create({ data: { callerId: req.user.id, receiverId, channelId, type, status: 'INITIATED' } });
    await notify(receiverId, { type: 'call', title: `${req.user.name || 'Someone'} is calling`, body: `Incoming ${type.toLowerCase()} call`, data: { callId: call.id, channelId, callerId: req.user.id } }, getIO());
    res.json({ success: true, call: { id: call.id, channelId } });
  } catch (err) { next(err); }
};

exports.updateCallStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const call = await prisma.call.findUnique({ where: { id: req.params.id } });
    if (!call) return res.status(404).json({ success: false, message: 'Call not found' });
    const data = { status };
    if (status === 'ACTIVE')   data.startedAt = new Date();
    if (['ENDED','REJECTED','MISSED'].includes(status)) {
      data.endedAt = new Date();
      if (call.startedAt) data.duration = Math.floor((new Date() - call.startedAt) / 1000);
    }
    const updated = await prisma.call.update({ where: { id: req.params.id }, data });
    res.json({ success: true, call: updated });
  } catch (err) { next(err); }
};

exports.getCallHistory = async (req, res, next) => {
  try {
    const { page = 1 } = req.query;
    const limit = 20, skip = (parseInt(page) - 1) * limit;
    const calls = await prisma.call.findMany({
      where: { OR: [{ callerId: req.user.id }, { receiverId: req.user.id }] },
      include: { caller: { select: { id: true, name: true, avatarUrl: true, avatarInitials: true } }, receiver: { select: { id: true, name: true, avatarUrl: true, avatarInitials: true } } },
      orderBy: { createdAt: 'desc' }, skip, take: limit,
    });
    res.json({ success: true, calls });
  } catch (err) { next(err); }
};
