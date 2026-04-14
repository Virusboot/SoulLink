// src/routes/call.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/call.controller');
const { auth } = require('../middleware/auth.middleware');
router.post  ('/initiate',   auth, ctrl.initiateCall);
router.patch ('/:id/status', auth, ctrl.updateCallStatus);
router.get   ('/history',    auth, ctrl.getCallHistory);
module.exports = router;
