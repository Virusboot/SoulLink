// src/routes/agora.routes.js
const router   = require('express').Router();
const ctrl     = require('../controllers/agora.controller');
const { auth } = require('../middleware/auth.middleware');
router.post('/token',          auth, ctrl.generateToken);
router.post('/stranger-token', auth, ctrl.generateStrangerToken);
module.exports = router;
