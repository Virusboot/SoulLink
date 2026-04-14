// src/app.js
const express     = require('express');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const authRoutes   = require('./routes/auth.routes');
const userRoutes   = require('./routes/user.routes');
const matchRoutes  = require('./routes/match.routes');
const chatRoutes   = require('./routes/chat.routes');
const roomRoutes   = require('./routes/room.routes');
const callRoutes   = require('./routes/call.routes');
const notifRoutes  = require('./routes/notification.routes');
const safetyRoutes = require('./routes/safety.routes');
const gameRoutes   = require('./routes/game.routes');
const uploadRoutes = require('./routes/upload.routes');
const agoraRoutes  = require('./routes/agora.routes');
const { errorHandler } = require('./middleware/error.middleware');

const app = express();
app.set('trust proxy', 1);

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin',  '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(compression());

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500, skip: r => r.method === 'OPTIONS' }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, skip: r => r.method === 'OPTIONS' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success:   true,
    message:   '💜 SoulLink API v3.1',
    version:   '3.1.0',
    timestamp: new Date().toISOString(),
    uptime:    `${Math.floor(process.uptime())}s`,
    agora:     !!process.env.AGORA_APP_ID,
    redis:     !!process.env.REDIS_URL,
  });
});

app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/matches',       matchRoutes);
app.use('/api/chat',          chatRoutes);
app.use('/api/rooms',         roomRoutes);
app.use('/api/calls',         callRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/safety',        safetyRoutes);
app.use('/api/games',         gameRoutes);
app.use('/api/upload',        uploadRoutes);
app.use('/api/agora',         agoraRoutes);

app.use('*', (req, res) => res.status(404).json({ success: false, message: `Not found: ${req.originalUrl}` }));
app.use(errorHandler);

module.exports = app;
