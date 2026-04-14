// src/middleware/auth.middleware.js
const jwt    = require('jsonwebtoken');
const prisma = require('../config/db');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'No token provided' });

    const token   = header.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET);

    const session = await prisma.session.findUnique({
      where: { token }, include: { user: true },
    });
    if (!session || session.expiresAt < new Date())
      return res.status(401).json({ success: false, message: 'Session expired' });

    req.user  = session.user;
    req.token = token;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

module.exports = { auth };
