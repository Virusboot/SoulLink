// src/controllers/agora.controller.js
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

const EXPIRE = 3600;

exports.generateToken = async (req, res, next) => {
  try {
    const APP_ID = process.env.AGORA_APP_ID;
    const APP_CERT = process.env.AGORA_APP_CERTIFICATE;
    const { channelName, uid = 0 } = req.body;
    if (!channelName) return res.status(400).json({ success: false, message: 'channelName required' });
    if (!APP_ID || !APP_CERT) return res.json({ success: true, token: null, channelName, appId: null, devMode: true });

    const expiry = Math.floor(Date.now() / 1000) + EXPIRE;
    const token  = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERT, channelName, Number(uid), RtcRole.PUBLISHER, expiry);
    res.json({ success: true, token, channelName, uid: Number(uid), appId: APP_ID, expiresAt: new Date(expiry * 1000).toISOString() });
  } catch (err) { next(err); }
};

exports.generateStrangerToken = async (req, res, next) => {
  try {
    const APP_ID = process.env.AGORA_APP_ID;
    const APP_CERT = process.env.AGORA_APP_CERTIFICATE;
    const { channelName } = req.body;
    if (!channelName) return res.status(400).json({ success: false, message: 'channelName required' });
    if (!APP_ID || !APP_CERT) return res.json({ success: true, token: null, channelName, appId: null, devMode: true });

    const expiry = Math.floor(Date.now() / 1000) + EXPIRE;
    const token  = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERT, channelName, 0, RtcRole.PUBLISHER, expiry);
    res.json({ success: true, token, channelName, appId: APP_ID, uid: 0, expiresAt: new Date(expiry * 1000).toISOString() });
  } catch (err) { next(err); }
};
