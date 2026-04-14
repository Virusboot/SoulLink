// src/routes/auth.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/auth.controller');
const { auth } = require('../middleware/auth.middleware');
router.post('/send-otp',   ctrl.sendOtp);
router.post('/verify-otp', ctrl.verifyOtp);
router.get ('/me',   auth, ctrl.getMe);
router.post('/logout', auth, ctrl.logout);
module.exports = router;
