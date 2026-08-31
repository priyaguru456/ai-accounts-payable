const prisma = require('../config/prisma');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAudit } = require('../utils/auditLogger');
const aiServiceClient = require('../services/aiServiceClient');
const notificationService = require('../services/notificationService');

const pending = asyncHandler(async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { status: 'PENDING_APPROVAL' },
    include: { vendor: true, riskAssessment: true, aiExtraction: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ invoices });
});

const act = asyncHandler(async (req, res) => {
  const { status, comments } = req.body;
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { aiExtraction: true },
  });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.status !== 'PENDING_APPROVAL' && invoice.status !== 'PENDING_REVIEW') {
    throw ApiError.badRequest(`Invoice is not awaiting approval (current status: ${invoice.status})`);
  }

  const approval = await prisma.approval.create({
    data: {
      invoiceId: invoice.id,
      approverId: req.user.id,
      status,
      comments,
      approvedAt: new Date(),
    },
  });

  const nextStatus = status === 'APPROVED' ? 'APPROVED' : 'REJECTED';
  await prisma.invoice.update({ where: { id: invoice.id }, data: { status: nextStatus } });

  await recordAudit({
    action: `INVOICE_${status}`,
    entity: 'Invoice',
    entityId: invoice.id,
    invoiceId: invoice.id,
    userId: req.user.id,
    metadata: { comments },
  });

  if (nextStatus === 'APPROVED' && invoice.aiExtraction?.ocrRawText) {
    // Best-effort: teaches the RAG store this vendor's layout from a human-confirmed
    // good extraction (see docs/ai-pipeline.md). Never blocks the approval response.
    aiServiceClient.submitRagExample({
      vendorId: invoice.vendorId,
      ocrText: invoice.aiExtraction.ocrRawText,
      extractedData: invoice.aiExtraction.extractedData,
    });
  }

  notificationService.notify(nextStatus === 'APPROVED' ? 'INVOICE_APPROVED' : 'INVOICE_REJECTED', {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    comments,
  });

  res.status(201).json({ approval });
});

module.exports = { pending, act };
