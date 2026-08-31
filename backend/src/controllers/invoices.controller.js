const prisma = require('../config/prisma');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAudit } = require('../utils/auditLogger');
const storageService = require('../services/storageService');
const queueService = require('../services/queueService');
const virusScanService = require('../services/virusScanService');
const { matchInvoice } = require('../modules/matching/matchingEngine');

function computeItemAmounts(items) {
  return items.map((item) => ({ ...item, amount: Number((item.quantity * item.unitPrice).toFixed(2)) }));
}

const list = asyncHandler(async (req, res) => {
  const { status, vendorId, matchStatus } = req.query;
  const where = {};
  if (status) where.status = status;
  if (vendorId) where.vendorId = vendorId;
  if (matchStatus) where.matchStatus = matchStatus;

  const invoices = await prisma.invoice.findMany({
    where,
    include: { vendor: true, riskAssessment: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ invoices });
});

const getById = asyncHandler(async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      vendor: true,
      items: true,
      purchaseOrder: { include: { items: true, goodsReceipts: { include: { items: true } } } },
      aiExtraction: true,
      riskAssessment: true,
      approvals: { include: { approver: true } },
      payment: true,
    },
  });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  res.json({ invoice });
});

const upload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No document file uploaded');

  const scanResult = await virusScanService.scanBuffer(req.file.buffer, req.file.originalname);
  if (!scanResult.clean) {
    throw ApiError.badRequest('Uploaded file failed the virus scan and was rejected');
  }

  const { vendorId, invoiceNumber, invoiceDate, dueDate, purchaseOrderId, currency, subtotal, taxAmount, totalAmount, items } = req.body;

  const existing = await prisma.invoice.findUnique({ where: { vendorId_invoiceNumber: { vendorId, invoiceNumber } } });
  if (existing) throw ApiError.conflict('An invoice with this number already exists for this vendor', { invoiceId: existing.id });

  const { url } = await storageService.saveInvoiceDocument(req.file.buffer, req.file.originalname);

  const invoice = await prisma.invoice.create({
    data: {
      vendorId,
      invoiceNumber,
      invoiceDate,
      dueDate,
      purchaseOrderId: purchaseOrderId || null,
      currency,
      subtotal,
      taxAmount,
      totalAmount,
      documentUrl: url,
      uploadedById: req.user.id,
      status: 'PROCESSING',
      items: { create: computeItemAmounts(items) },
    },
  });

  await recordAudit({ action: 'INVOICE_UPLOADED', entity: 'Invoice', entityId: invoice.id, invoiceId: invoice.id, userId: req.user.id });

  await queueService.enqueueInvoiceProcessing(invoice.id);

  res.status(201).json({ invoice });
});

const reprocess = asyncHandler(async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) throw ApiError.notFound('Invoice not found');

  await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'PROCESSING' } });
  await queueService.enqueueInvoiceProcessing(invoice.id);

  await recordAudit({ action: 'INVOICE_REPROCESS_TRIGGERED', entity: 'Invoice', entityId: invoice.id, invoiceId: invoice.id, userId: req.user.id });
  res.json({ message: 'Reprocessing triggered' });
});

const manualMatch = asyncHandler(async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) throw ApiError.notFound('Invoice not found');

  const result = await matchInvoice(req.params.id);
  await recordAudit({ action: 'INVOICE_MANUAL_MATCH', entity: 'Invoice', entityId: invoice.id, invoiceId: invoice.id, userId: req.user.id, metadata: { matchStatus: result.matchStatus } });

  res.json(result);
});

module.exports = { list, getById, upload, reprocess, manualMatch };
