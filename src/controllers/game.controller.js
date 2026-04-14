// src/controllers/game.controller.js
const prisma  = require('../config/db');
const gameSvc = require('../services/game.service');

exports.createGame = async (req, res, next) => {
  try {
    const { type, opponentId } = req.body;
    const valid = ['truth_or_dare','would_you_rather','trivia'];
    if (!valid.includes(type)) return res.status(400).json({ success: false, message: `type must be: ${valid.join(', ')}` });
    const game = await gameSvc.createGame(type, [req.user.id, opponentId]);
    res.status(201).json({ success: true, game });
  } catch (err) { next(err); }
};

exports.gameAction = async (req, res, next) => {
  try {
    const { action } = req.body;
    const game = await prisma.game.findUnique({ where: { id: req.params.id }, include: { participants: true } });
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    if (game.currentTurn !== req.user.id) return res.status(403).json({ success: false, message: 'Not your turn' });
    const participantIds = game.participants.map(p => p.userId);
    const result = await gameSvc.nextTurn(game.id, req.user.id, action, participantIds);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

exports.getGame = async (req, res, next) => {
  try {
    const game = await prisma.game.findUnique({ where: { id: req.params.id }, include: { participants: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } } });
    if (!game) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, game });
  } catch (err) { next(err); }
};

exports.endGame = async (req, res, next) => {
  try {
    await gameSvc.endGame(req.params.id, req.body.winnerId);
    res.json({ success: true });
  } catch (err) { next(err); }
};
