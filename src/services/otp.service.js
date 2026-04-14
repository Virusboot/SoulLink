// src/services/otp.service.js
const logger = require('../config/logger');

const generateOtp = () =>
  process.env.OTP_DEV_MODE === 'true'
    ? (process.env.OTP_DEV_CODE || '123456')
    : Math.floor(100000 + Math.random() * 900000).toString();

const sendOtp = async (phone, code) => {
  if (process.env.OTP_DEV_MODE === 'true') {
    logger.info(`[OTP DEV] ${phone} → ${code}`);
    return true;
  }
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    body: `Your SoulLink OTP is ${code}. Valid for 10 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to:   phone,
  });
  return true;
};

module.exports = { generateOtp, sendOtp };
