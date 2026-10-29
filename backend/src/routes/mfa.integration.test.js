const request = require('supertest');
const app = require('../app');
const prisma = require('../config/prisma');
const notificationService = require('../services/notificationService');
const { cleanupTestUsers } = require('../utils/testHelpers/cleanupTestUsers');

describe('email-OTP MFA (integration)', () => {
  const email = `mfa-user-${Date.now()}@example.com`;
  const password = 'correct-horse-battery-staple';
  let token;
  let userId;

  beforeAll(async () => {
    const registered = await request(app).post('/api/v1/auth/register').send({ email, password, name: 'MFA User' });
    token = registered.body.token;
    userId = registered.body.user.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId } });
    await cleanupTestUsers([email]);
    await prisma.$disconnect();
  });

  it('logs in without a code when MFA is disabled', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.mfaRequired).toBeUndefined();
  });

  it('requires a verification code after MFA is enabled, and rejects a wrong one', async () => {
    const enable = await request(app).post('/api/v1/auth/mfa/enable').set('Authorization', `Bearer ${token}`);
    expect(enable.status).toBe(200);
    expect(enable.body.mfaEnabled).toBe(true);

    const notifySpy = jest.spyOn(notificationService, 'notify');

    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.mfaRequired).toBe(true);
    expect(login.body.userId).toBe(userId);
    expect(login.body.token).toBeUndefined();

    const otpCall = notifySpy.mock.calls.find(([eventType]) => eventType === 'OTP_LOGIN_CODE');
    expect(otpCall).toBeDefined();
    const realOtp = otpCall[1].otp;

    const wrong = await request(app).post('/api/v1/auth/verify-otp').send({ userId, otp: '000000' });
    expect(wrong.status).toBe(401);

    const right = await request(app).post('/api/v1/auth/verify-otp').send({ userId, otp: realOtp });
    expect(right.status).toBe(200);
    expect(right.body.token).toBeDefined();

    // A used/expired code can't be replayed.
    const replay = await request(app).post('/api/v1/auth/verify-otp').send({ userId, otp: realOtp });
    expect(replay.status).toBe(401);

    notifySpy.mockRestore();
  });

  it('disabling MFA returns login to single-step', async () => {
    const disable = await request(app).post('/api/v1/auth/mfa/disable').set('Authorization', `Bearer ${token}`);
    expect(disable.status).toBe(200);
    expect(disable.body.mfaEnabled).toBe(false);

    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
  });
});
