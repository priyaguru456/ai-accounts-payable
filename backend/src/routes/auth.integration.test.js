// Integration tests hit a REAL database (DATABASE_URL from the environment — point it
// at a disposable test DB, e.g. ai_accounts_payable_test, never the dev/prod one).
// Run: npx prisma migrate deploy (against the test DB) then npm run test:integration.
const request = require('supertest');
const app = require('../app');
const prisma = require('../config/prisma');

describe('auth routes (integration)', () => {
  const email = `test-${Date.now()}@example.com`;
  const password = 'correct-horse-battery-staple';

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('registers a new user and returns a token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email,
      password,
      name: 'Test User',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('AP_SPECIALIST');
  });

  it('rejects registering the same email twice', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email,
      password,
      name: 'Test User',
    });

    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    const good = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(good.status).toBe(200);
    expect(good.body.token).toBeDefined();

    const bad = await request(app).post('/api/v1/auth/login').send({ email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('rejects /auth/me without a token and accepts it with one', async () => {
    const noToken = await request(app).get('/api/v1/auth/me');
    expect(noToken.status).toBe(401);

    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    const withToken = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.token}`);

    expect(withToken.status).toBe(200);
    expect(withToken.body.user.email).toBe(email);
  });
});
