const request = require('supertest');
const app = require('../app');
const prisma = require('../config/prisma');
const { cleanupTestUsers } = require('../utils/testHelpers/cleanupTestUsers');

describe('vendor bank-detail change auditing (integration)', () => {
  const adminEmail = `bankchange-admin-${Date.now()}@example.com`;
  const password = 'correct-horse-battery-staple';
  let adminToken;
  let vendorId;

  beforeAll(async () => {
    const admin = await request(app).post('/api/v1/auth/register').send({
      email: adminEmail,
      password,
      name: 'Bank Change Admin',
      role: 'ADMIN',
    });
    adminToken = admin.body.token;

    const vendor = await request(app)
      .post('/api/v1/vendors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Bank Change Vendor ${Date.now()}`, bankAccount: '1111222233334444', ifsc: 'HDFC0001234' });
    vendorId = vendor.body.vendor.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entity: 'Vendor', entityId: vendorId } });
    await prisma.vendor.deleteMany({ where: { id: vendorId } });
    await cleanupTestUsers([adminEmail]);
    await prisma.$disconnect();
  });

  it('does not write a VENDOR_BANK_DETAILS_CHANGED entry for a non-bank field update', async () => {
    const res = await request(app)
      .patch(`/api/v1/vendors/${vendorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '+91-9999999999' });
    expect(res.status).toBe(200);

    const entries = await prisma.auditLog.findMany({
      where: { entity: 'Vendor', entityId: vendorId, action: 'VENDOR_BANK_DETAILS_CHANGED' },
    });
    expect(entries).toHaveLength(0);
  });

  it('writes a VENDOR_BANK_DETAILS_CHANGED entry when bankAccount changes', async () => {
    const res = await request(app)
      .patch(`/api/v1/vendors/${vendorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ bankAccount: '5555666677778888' });
    expect(res.status).toBe(200);

    const entries = await prisma.auditLog.findMany({
      where: { entity: 'Vendor', entityId: vendorId, action: 'VENDOR_BANK_DETAILS_CHANGED' },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].metadata.bankAccountChanged).toBe(true);
    expect(entries[0].metadata.ifscChanged).toBe(false);
  });

  it('does not flag re-submitting the same bank account value', async () => {
    await request(app)
      .patch(`/api/v1/vendors/${vendorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ bankAccount: '5555666677778888' });

    const entries = await prisma.auditLog.findMany({
      where: { entity: 'Vendor', entityId: vendorId, action: 'VENDOR_BANK_DETAILS_CHANGED' },
    });
    expect(entries).toHaveLength(1); // still just the one from the previous test
  });
});
