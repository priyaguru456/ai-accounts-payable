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
  const { idempotencyKey } = req.body;

  // A retried "create payment" request (client timeout + retry, or — once a real
  // gateway is wired in — a redelivered initiation call) with the same idempotency
  // key returns the original payment instead of erroring or double-creating one.
  if (idempotencyKey) {
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existing) return res.status(200).json({ payment: existing, idempotent: true });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.status !== 'APPROVED') throw ApiError.badRequest('Only approved invoices can be paid');

  let payment;
  try {
    payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: req.body.amount,
        paymentDate: req.body.paymentDate,
        transactionId: req.body.transactionId,
        idempotencyKey: idempotencyKey || null,
      },
    });
  } catch (err) {
    // Payment.invoiceId is @unique — a second concurrent create for the same invoice
    // hits this constraint rather than silently creating a duplicate payment.
    if (err.code === 'P2002') {
      const existing = await prisma.payment.findUnique({ where: { invoiceId: invoice.id } });
      throw ApiError.conflict('A payment already exists for this invoice', { paymentId: existing?.id });
    }
    throw err;
  }

  await recordAudit({ action: 'PAYMENT_CREATED', entity: 'Payment', entityId: payment.id, invoiceId: invoice.id, userId: req.user.id });
  res.status(201).json({ payment });
});

const update = asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { invoice: true } });
  if (!payment) throw ApiError.notFound('Payment not found');

  let updated;
  let wonCompletionRace = false;

  if (req.body.status === 'COMPLETED') {
    // Atomic conditional update: only the request that actually flips status from
    // non-COMPLETED to COMPLETED gets count=1 and "wins" the right to fire the
    // invoice-PAID transition and notification. Two concurrent PATCH requests can no
    // longer both pass a stale in-memory check and both fire side effects.
    const result = await prisma.payment.updateMany({
      where: { id: payment.id, status: { not: 'COMPLETED' } },
      data: req.body,
    });
    wonCompletionRace = result.count === 1;
    updated = await prisma.payment.findUnique({ where: { id: payment.id } });
  } else {
    updated = await prisma.payment.update({ where: { id: payment.id }, data: req.body });
  }

  if (wonCompletionRace) {
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
