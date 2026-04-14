// src/controllers/safety.controller.js
const prisma = require('../config/db');

exports.reportUser = async (req, res, next) => {
  try {
    const { reportedId, reason, details } = req.body;
    if (!reportedId || !reason) return res.status(400).json({ success: false, message: 'reportedId and reason required' });
    if (reportedId === req.user.id) return res.status(400).json({ success: false, message: 'Cannot report yourself' });
    const valid = ['spam','harassment','inappropriate','fake','other'];
    if (!valid.includes(reason)) return res.status(400).json({ success: false, message: `reason must be: ${valid.join(', ')}` });
    const report = await prisma.report.create({ data: { reporterId: req.user.id, reportedId, reason, details: details || null } });
    await prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: req.user.id, blockedId: reportedId } }, create: { blockerId: req.user.id, blockedId: reportedId }, update: {} });
    res.status(201).json({ success: true, message: 'Report submitted. User has been blocked.', reportId: report.id });
  } catch (err) { next(err); }
};

exports.getReports = async (req, res, next) => {
  try {
    const { status = 'PENDING', page = 1 } = req.query;
    const limit = 20;
    const reports = await prisma.report.findMany({
      where: { status }, skip: (parseInt(page) - 1) * limit, take: limit,
      include: { reporter: { select: { id: true, name: true, phone: true } }, reported: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, reports });
  } catch (err) { next(err); }
};

exports.updateReport = async (req, res, next) => {
  try {
    await prisma.report.update({ where: { id: req.params.id }, data: { status: req.body.status } });
    res.json({ success: true });
  } catch (err) { next(err); }
};
