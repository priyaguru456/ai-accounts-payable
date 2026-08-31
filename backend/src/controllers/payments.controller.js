const prisma = require('../config/prisma');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAudit } = require('../utils/auditLogger');
const notificationService = require('../services/notificationService');

const list = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = status ? { status } : {};
  const payments = await prisma.payment.findMany({
    where,
    include: { invoice: { include: { vendor: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ payments });
});

const create = asyncHandler(async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.status !== 'APPROVED') throw ApiError.badRequest('Only approved invoices can be paid');

  const payment = await prisma.payment.create({
    data: { invoiceId: invoice.id, amount: req.body.amount, paymentDate: req.body.paymentDate, transactionId: req.body.transactionId },
  });

  await recordAudit({ action: 'PAYMENT_CREATED', entity: 'Payment', entityId: payment.id, invoiceId: invoice.id, userId: req.user.id });
  res.status(201).json({ payment });
});

const update = asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { invoice: true } });
  if (!payment) throw ApiError.notFound('Payment not found');

  const wasAlreadyCompleted = payment.status === 'COMPLETED';
  const updated = await prisma.payment.update({ where: { id: payment.id }, data: req.body });

  if (updated.status === 'COMPLETED' && !wasAlreadyCompleted) {
    await prisma.invoice.update({ where: { id: updated.invoiceId }, data: { status: 'PAID' } });
    notificationService.notify('PAYMENT_COMPLETED', {
      invoiceId: updated.invoiceId,
      invoiceNumber: payment.invoice.invoiceNumber,
      amount: updated.amount,
    });
  }

  await recordAudit({ action: 'PAYMENT_UPDATED', entity: 'Payment', entityId: payment.id, invoiceId: payment.invoiceId, userId: req.user.id, metadata: req.body });
  res.json({ payment: updated });
});

module.exports = { list, create, update };
