// src/routes/room.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/room.controller');
const { auth } = require('../middleware/auth.middleware');
router.get   ('/',                auth, ctrl.getRooms);
router.post  ('/',                auth, ctrl.createRoom);
router.get   ('/:id',             auth, ctrl.getRoom);
router.post  ('/:id/join',        auth, ctrl.joinRoom);
router.delete('/:id/leave',       auth, ctrl.leaveRoom);
router.patch ('/:id/member-role', auth, ctrl.updateMemberRole);
module.exports = router;
