// src/routes/game.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/game.controller');
const { auth } = require('../middleware/auth.middleware');
router.post  ('/',           auth, ctrl.createGame);
router.get   ('/:id',        auth, ctrl.getGame);
router.post  ('/:id/action', auth, ctrl.gameAction);
router.delete('/:id',        auth, ctrl.endGame);
module.exports = router;
