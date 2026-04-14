// src/routes/upload.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/upload.controller');
const { auth } = require('../middleware/auth.middleware');
router.post('/avatar', auth, ctrl.uploadAvatar);
router.post('/media',  auth, ctrl.uploadMedia);
module.exports = router;
