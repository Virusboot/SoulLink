// src/routes/match.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/match.controller');
const { auth } = require('../middleware/auth.middleware');
router.get ('/likes',    auth, ctrl.getLikes);
router.get ('/',         auth, ctrl.getMatches);
router.post('/like/:id', auth, ctrl.likeUser);
router.post('/pass/:id', auth, ctrl.passUser);
module.exports = router;
