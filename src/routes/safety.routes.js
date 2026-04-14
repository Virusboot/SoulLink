// src/routes/safety.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/safety.controller');
const { auth } = require('../middleware/auth.middleware');
router.post  ('/report',      auth, ctrl.reportUser);
router.get   ('/reports',     auth, ctrl.getReports);
router.patch ('/reports/:id', auth, ctrl.updateReport);
module.exports = router;
