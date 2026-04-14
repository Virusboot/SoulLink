// src/routes/user.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/user.controller');
const { auth } = require('../middleware/auth.middleware');
router.get   ('/me',        auth, ctrl.getMyProfile);
router.put   ('/me',        auth, ctrl.updateProfile);
router.get   ('/discover',  auth, ctrl.discoverUsers);
router.get   ('/interests', auth, ctrl.getAllInterests);
router.get   ('/blocked',   auth, ctrl.getBlockedUsers);
router.post  ('/block/:id', auth, ctrl.blockUser);
router.delete('/block/:id', auth, ctrl.unblockUser);
router.get   ('/:id',       auth, ctrl.getUserById);
module.exports = router;
