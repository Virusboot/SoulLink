// src/controllers/upload.controller.js
const prisma  = require('../config/db');
const { uploadBuffer } = require('../services/cloudinary.service');
const multer  = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, ['image/jpeg','image/png','image/webp','video/mp4'].includes(file.mimetype));
  },
});

exports.uploadAvatar = [
  upload.single('avatar'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
      const result = await uploadBuffer(req.file.buffer, { folder: 'soullink/avatars', transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }], public_id: `avatar_${req.user.id}`, overwrite: true });
      await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: result.secure_url } });
      res.json({ success: true, avatarUrl: result.secure_url });
    } catch (err) { next(err); }
  },
];

exports.uploadMedia = [
  upload.single('media'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
      const isVideo = req.file.mimetype.startsWith('video/');
      const result  = await uploadBuffer(req.file.buffer, { folder: 'soullink/media', resource_type: isVideo ? 'video' : 'image' });
      res.json({ success: true, url: result.secure_url, mediaType: isVideo ? 'video' : 'image' });
    } catch (err) { next(err); }
  },
];
