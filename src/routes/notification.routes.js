// src/routes/notification.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/notification.controller');
const { auth } = require('../middleware/auth.middleware');
router.get   ('/',           auth, ctrl.getNotifications);
router.patch ('/read-all',   auth, ctrl.markAllRead);
router.delete('/',           auth, ctrl.clearAll);
router.patch ('/:id/read',   auth, ctrl.markRead);
router.delete('/:id',        auth, ctrl.deleteNotification);
module.exports = router;
