const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const env = require('../config/env');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAudit } = require('../utils/auditLogger');
const notificationService = require('../services/notificationService');
const { generateOtp, hashOtp, OTP_TTL_MS } = require('../utils/otp');

const SALT_ROUNDS = 12;
const REFRESH_COOKIE_NAME = 'ap_refresh_token';

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function refreshTtlMs() {
  const match = /^(\d+)([smhd])$/.exec(env.refreshTokenExpiresIn);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const [, n, unit] = match;
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(n) * multipliers[unit];
}

// Refresh tokens are random opaque strings (not JWTs) so they can be revoked
// server-side; only their SHA-256 hash is stored, mirroring how passwords are hashed,
// so a DB leak alone doesn't hand out valid refresh tokens.
async function issueRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const refreshTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const refreshTokenExpiresAt = new Date(Date.now() + refreshTtlMs());

  await prisma.user.update({ where: { id: userId }, data: { refreshTokenHash, refreshTokenExpiresAt } });
  return { token, refreshTokenExpiresAt };
}

function setRefreshCookie(res, token, expiresAt) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: expiresAt,
    path: '/api/v1/auth',
  });
}

const register = asyncHandler(async (req, res) => {
  const { email, password, name, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: role || 'AP_SPECIALIST' },
  });

  await recordAudit({ action: 'USER_REGISTERED', entity: 'User', entityId: user.id, userId: user.id });

  const token = signAccessToken(user);
  const { token: refreshToken, refreshTokenExpiresAt } = await issueRefreshToken(user.id);
  setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);

  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid email or password');

  if (user.status !== 'ACTIVE') throw ApiError.forbidden('Account is inactive');

  if (user.mfaEnabled) {
    const otp = generateOtp();
    await prisma.user.update({
      where: { id: user.id },
      data: { otpHash: hashOtp(otp), otpExpiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
    notificationService.notify('OTP_LOGIN_CODE', { otp, email: user.email });
    await recordAudit({ action: 'USER_LOGIN_OTP_SENT', entity: 'User', entityId: user.id, userId: user.id });

    res.json({ mfaRequired: true, userId: user.id });
    return;
  }

  const token = signAccessToken(user);
  const { token: refreshToken, refreshTokenExpiresAt } = await issueRefreshToken(user.id);
  setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);

  await recordAudit({ action: 'USER_LOGIN', entity: 'User', entityId: user.id, userId: user.id });

  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { userId, otp } = req.body;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaEnabled || !user.otpHash || !user.otpExpiresAt) {
    throw ApiError.unauthorized('No verification code pending for this user');
  }
  if (user.otpExpiresAt < new Date()) {
    throw ApiError.unauthorized('Verification code has expired');
  }
  // Constant-time compare so response timing can't leak how many hash bytes matched.
  const presentedHash = Buffer.from(hashOtp(otp));
  const storedHash = Buffer.from(user.otpHash);
  if (presentedHash.length !== storedHash.length || !crypto.timingSafeEqual(presentedHash, storedHash)) {
    throw ApiError.unauthorized('Invalid verification code');
  }

  await prisma.user.update({ where: { id: user.id }, data: { otpHash: null, otpExpiresAt: null } });

  const token = signAccessToken(user);
  const { token: refreshToken, refreshTokenExpiresAt } = await issueRefreshToken(user.id);
  setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);

  await recordAudit({ action: 'USER_LOGIN', entity: 'User', entityId: user.id, userId: user.id });

  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
  });
});

const setMfaEnabled = (enabled) =>
  asyncHandler(async (req, res) => {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { mfaEnabled: enabled, otpHash: null, otpExpiresAt: null },
    });
    await recordAudit({
      action: enabled ? 'USER_MFA_ENABLED' : 'USER_MFA_DISABLED',
      entity: 'User',
      entityId: req.user.id,
      userId: req.user.id,
    });
    res.json({ mfaEnabled: enabled });
  });

const enableMfa = setMfaEnabled(true);
const disableMfa = setMfaEnabled(false);

const refresh = asyncHandler(async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!presented) throw ApiError.unauthorized('No refresh token presented');

  const presentedHash = crypto.createHash('sha256').update(presented).digest('hex');
  const user = await prisma.user.findFirst({ where: { refreshTokenHash: presentedHash } });

  if (!user || !user.refreshTokenExpiresAt || user.refreshTokenExpiresAt < new Date()) {
    throw ApiError.unauthorized('Refresh token is invalid or expired');
  }

  // Rotate: issue a brand new refresh token and invalidate the presented one, so a
  // stolen-but-unused token can't be replayed after the legitimate client refreshes.
  const token = signAccessToken(user);
  const { token: refreshToken, refreshTokenExpiresAt } = await issueRefreshToken(user.id);
  setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);

  res.json({ token });
});

const logout = asyncHandler(async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE_NAME];
  if (presented) {
    const presentedHash = crypto.createHash('sha256').update(presented).digest('hex');
    await prisma.user.updateMany({
      where: { refreshTokenHash: presentedHash },
      data: { refreshTokenHash: null, refreshTokenExpiresAt: null },
    });
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
  res.json({ message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

module.exports = { register, login, verifyOtp, refresh, logout, me, enableMfa, disableMfa };
