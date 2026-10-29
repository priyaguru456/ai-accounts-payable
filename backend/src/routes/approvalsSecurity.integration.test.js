const request = require('supertest');
const app = require('../app');
const prisma = require('../config/prisma');
const { cleanupTestUsers } = require('../utils/testHelpers/cleanupTestUsers');

describe('approval segregation of duties (integration)', () => {
  const uploaderEmail = `sod-uploader-${Date.now()}@example.com`;
  const approverEmail = `sod-approver-${Date.now()}@example.com`;
  const password = 'correct-horse-battery-staple';
  let uploaderToken;
  let approverToken;
  let uploaderId;
  let vendorId;
  let invoiceId;

  beforeAll(async () => {
    const uploader = await request(app).post('/api/v1/auth/register').send({
      email: uploaderEmail,
      password,
      name: 'SoD Uploader',
      role: 'AP_SPECIALIST',
    });
    uploaderToken = uploader.body.token;
    uploaderId = uploader.body.user.id;

    const approver = await request(app).post('/api/v1/auth/register').send({
      email: approverEmail,
      password,
      name: 'SoD Approver',
      role: 'FINANCE_MANAGER',
    });
    approverToken = approver.body.token;

    const vendor = await request(app)
      .post('/api/v1/vendors')
      .set('Authorization', `Bearer ${uploaderToken}`)
      .send({ name: `SoD Test Vendor ${Date.now()}` });
    vendorId = vendor.body.vendor.id;

    const invoice = await prisma.invoice.create({
      data: {
        vendorId,
        invoiceNumber: `SOD-${Date.now()}`,
        invoiceDate: new Date(),
        currency: 'INR',
        subtotal: 100,
        taxAmount: 0,
        totalAmount: 100,
        uploadedById: uploaderId,
        status: 'PENDING_APPROVAL',
      },
    });
    invoiceId = invoice.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { invoiceId } });
    await prisma.approval.deleteMany({ where: { invoiceId } });
    await prisma.invoice.deleteMany({ where: { id: invoiceId } });
    await prisma.vendor.deleteMany({ where: { id: vendorId } });
    await cleanupTestUsers([uploaderEmail, approverEmail]);
    await prisma.$disconnect();
  });

  it('blocks the uploader from approving their own invoice', async () => {
    const res = await request(app)
      .post(`/api/v1/approvals/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${uploaderToken}`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(403);

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(invoice.status).toBe('PENDING_APPROVAL');
  });

  it('allows a different user to approve the invoice', async () => {
    const res = await request(app)
      .post(`/api/v1/approvals/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(201);

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(invoice.status).toBe('APPROVED');
  });
});
