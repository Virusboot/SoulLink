// src/middleware/error.middleware.js
const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message || err);
  if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'Already exists' });
  if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Not found' });
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};

module.exports = { errorHandler };
