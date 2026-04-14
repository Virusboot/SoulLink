// src/controllers/auth.controller.js
const prisma  = require('../config/db');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { generateOtp, sendOtp } = require('../services/otp.service');

exports.sendOtp = async (req, res, next) => {
  try {
    const { phone, countryCode = '+91' } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone required' });
    const fullPhone = `${countryCode}${phone}`;
    let user = await prisma.user.findUnique({ where: { phone: fullPhone } });
    if (!user) user = await prisma.user.create({ data: { phone: fullPhone, countryCode } });
    await prisma.otpCode.updateMany({ where: { userId: user.id, used: false }, data: { used: true } });
    const code = generateOtp();
    await prisma.otpCode.create({ data: { userId: user.id, code, expiresAt: new Date(Date.now() + 10 * 60000) } });
    await sendOtp(fullPhone, code);
    res.json({ success: true, message: `OTP sent to ${fullPhone}` });
  } catch (err) { next(err); }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, countryCode = '+91', otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ success: false, message: 'Phone and OTP required' });
    const fullPhone = `${countryCode}${phone}`;
    const user = await prisma.user.findUnique({ where: { phone: fullPhone } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const record = await prisma.otpCode.findFirst({
      where: { userId: user.id, code: otp, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });
    const token = uuidv4();
    await prisma.session.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + 30 * 24 * 3600000) } });
    const jwt_token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token: jwt_token, isNewUser: !user.name, user: { id: user.id, phone: user.phone, name: user.name, age: user.age, bio: user.bio, gender: user.gender, avatarUrl: user.avatarUrl, avatarInitials: user.avatarInitials, isVerified: user.isVerified, soulScore: user.soulScore } });
  } catch (err) { next(err); }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { interests: { include: { interest: true } } } });
    res.json({ success: true, user });
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    await prisma.session.deleteMany({ where: { token: req.token } });
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
};
