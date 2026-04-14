// src/routes/chat.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/chat.controller');
const { auth } = require('../middleware/auth.middleware');
router.get   ('/conversations',             auth, ctrl.getConversations);
router.get   ('/:conversationId/messages',  auth, ctrl.getMessages);
router.post  ('/:conversationId/messages',  auth, ctrl.sendMessage);
router.patch ('/:conversationId/read',      auth, ctrl.markRead);
router.delete('/messages/:messageId',       auth, ctrl.deleteMessage);
module.exports = router;
