const request = require('supertest');
const app = require('../app');
const prisma = require('../config/prisma');
const { cleanupTestUsers } = require('../utils/testHelpers/cleanupTestUsers');

describe('vendor routes (integration)', () => {
  const adminEmail = `admin-${Date.now()}@example.com`;
  const specialistEmail = `specialist-${Date.now()}@example.com`;
  const password = 'correct-horse-battery-staple';
  let adminToken;
  let specialistToken;
  let createdVendorId;

  beforeAll(async () => {
    const admin = await request(app).post('/api/v1/auth/register').send({
      email: adminEmail,
      password,
      name: 'Admin',
      role: 'ADMIN',
    });
    adminToken = admin.body.token;

    const specialist = await request(app).post('/api/v1/auth/register').send({
      email: specialistEmail,
      password,
      name: 'Specialist',
      role: 'AP_SPECIALIST',
    });
    specialistToken = specialist.body.token;
  });

  afterAll(async () => {
    if (createdVendorId) await prisma.vendor.deleteMany({ where: { id: createdVendorId } });
    await cleanupTestUsers([adminEmail, specialistEmail]);
    await prisma.$disconnect();
  });

  it('lets an AP_SPECIALIST create a vendor with bank details that round-trip decrypted', async () => {
    const res = await request(app)
      .post('/api/v1/vendors')
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ name: 'Acme Corp', bankAccount: '1234567890', ifsc: 'ACME0001234' });

    expect(res.status).toBe(201);
    createdVendorId = res.body.vendor.id;
    // The API response must return decrypted values, even though they're encrypted at rest.
    expect(res.body.vendor.bankAccount).toBe('1234567890');
    expect(res.body.vendor.ifsc).toBe('ACME0001234');
  });

  it('stores bank fields encrypted at rest when FIELD_ENCRYPTION_KEY is set', async () => {
    if (!process.env.FIELD_ENCRYPTION_KEY) return; // skipped: encryption not configured for this run
    const raw = await prisma.vendor.findUnique({ where: { id: createdVendorId } });
    expect(raw.bankAccount.startsWith('enc:')).toBe(true);
  });

  it('rejects DELETE (deactivate) from a non-ADMIN role', async () => {
    const res = await request(app)
      .delete(`/api/v1/vendors/${createdVendorId}`)
      .set('Authorization', `Bearer ${specialistToken}`);

    expect(res.status).toBe(403);
  });

  it('allows ADMIN to deactivate a vendor', async () => {
    const res = await request(app)
      .delete(`/api/v1/vendors/${createdVendorId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.vendor.isActive).toBe(false);
  });
});
