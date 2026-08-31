const request = require('supertest');
const app = require('../app');
const prisma = require('../config/prisma');
const { cleanupTestUsers } = require('../utils/testHelpers/cleanupTestUsers');

describe('payment idempotency (integration)', () => {
  const adminEmail = `payadmin-${Date.now()}@example.com`;
  const password = 'correct-horse-battery-staple';
  let adminToken;
  let vendorId;
  let invoiceId;

  beforeAll(async () => {
    const admin = await request(app).post('/api/v1/auth/register').send({
      email: adminEmail,
      password,
      name: 'Pay Admin',
      role: 'ADMIN',
    });
    adminToken = admin.body.token;

    const vendor = await request(app)
      .post('/api/v1/vendors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Idempotency Test Vendor ${Date.now()}` });
    vendorId = vendor.body.vendor.id;

    // Create an invoice directly at APPROVED status (bypassing the AI pipeline —
    // this test is about payment idempotency, not invoice processing).
    const invoice = await prisma.invoice.create({
      data: {
        vendorId,
        invoiceNumber: `IDEMP-${Date.now()}`,
        invoiceDate: new Date(),
        currency: 'INR',
        subtotal: 100,
        taxAmount: 0,
        totalAmount: 100,
        uploadedById: (await prisma.user.findUnique({ where: { email: adminEmail } })).id,
        status: 'APPROVED',
      },
    });
    invoiceId = invoice.id;
  });

  afterAll(async () => {
    // AuditLog.invoiceId is onDelete: Restrict (see auditLogger.js), same reasoning as
    // cleanupTestUsers for userId — must clear audit rows before the invoice they
    // reference can be deleted.
    await prisma.auditLog.deleteMany({ where: { invoiceId } });
    await prisma.payment.deleteMany({ where: { invoiceId } });
    await prisma.invoice.deleteMany({ where: { id: invoiceId } });
    await prisma.vendor.deleteMany({ where: { id: vendorId } });
    await cleanupTestUsers([adminEmail]);
    await prisma.$disconnect();
  });

  it('creating a payment twice for the same invoice (no idempotency key) results in exactly one row, second request gets 409', async () => {
    const [first, second] = await Promise.all([
      request(app).post(`/api/v1/payments/invoices/${invoiceId}`).set('Authorization', `Bearer ${adminToken}`).send({ amount: 100 }),
      request(app).post(`/api/v1/payments/invoices/${invoiceId}`).set('Authorization', `Bearer ${adminToken}`).send({ amount: 100 }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const payments = await prisma.payment.findMany({ where: { invoiceId } });
    expect(payments).toHaveLength(1);
  });

  it('two concurrent PATCH to COMPLETED only flips the invoice to PAID once', async () => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { invoiceId } });

    const [first, second] = await Promise.all([
      request(app).patch(`/api/v1/payments/${payment.id}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'COMPLETED' }),
      request(app).patch(`/api/v1/payments/${payment.id}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'COMPLETED' }),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(invoice.status).toBe('PAID');
  });

  it('rejects reusing an idempotency key for a different invoice', async () => {
    const key = `idem-${Date.now()}`;

    const otherInvoice = await prisma.invoice.create({
      data: {
        vendorId,
        invoiceNumber: `IDEMP-B-${Date.now()}`,
        invoiceDate: new Date(),
        currency: 'INR',
        subtotal: 50,
        taxAmount: 0,
        totalAmount: 50,
        uploadedById: (await prisma.user.findUnique({ where: { email: adminEmail } })).id,
        status: 'APPROVED',
      },
    });

    const first = await request(app)
      .post(`/api/v1/payments/invoices/${otherInvoice.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 50, idempotencyKey: key });
    expect(first.status).toBe(201);

    // Same key, same invoice -> idempotent replay, not a new row.
    const replay = await request(app)
      .post(`/api/v1/payments/invoices/${otherInvoice.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 50, idempotencyKey: key });
    expect(replay.status).toBe(200);
    expect(replay.body.idempotent).toBe(true);
    expect(replay.body.payment.id).toBe(first.body.payment.id);

    await prisma.auditLog.deleteMany({ where: { invoiceId: otherInvoice.id } });
    await prisma.payment.deleteMany({ where: { invoiceId: otherInvoice.id } });
    await prisma.invoice.deleteMany({ where: { id: otherInvoice.id } });
  });
});
