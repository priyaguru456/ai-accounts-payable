const prisma = require('../../config/prisma');
const aiServiceClient = require('../../services/aiServiceClient');
const { matchInvoice } = require('../matching/matchingEngine');
const { findFuzzyDuplicates } = require('../duplicateDetection/duplicateDetection');
const { recordAudit } = require('../../utils/auditLogger');
const notificationService = require('../../services/notificationService');
const logger = require('../../config/logger');

const CONFIDENCE_THRESHOLD = 0.75;

// In-flight guard: BullMQ's jobId dedup (see queueService.js) stops a second job from
// being *enqueued*, but at-least-once delivery can still redeliver the same job to this
// same process. This set stops a genuinely concurrent double-run within one process;
// cross-process double-delivery is covered by the AIExtraction/AIRiskAssessment upserts
// below being naturally idempotent (same invoiceId always overwrites, never duplicates).
const inFlight = new Set();

// Runs the full AI pipeline for an already-created invoice: OCR/LLM extraction,
// duplicate check, PO/GR matching, risk assessment, then decides the resulting status.
// Called either inline (dev, no queue) or from the worker service (BullMQ job).
async function processInvoice(invoiceId) {
  if (inFlight.has(invoiceId)) {
    logger.warn(`Invoice ${invoiceId} is already being processed in this process; skipping duplicate run`);
    return;
  }
  inFlight.add(invoiceId);

  try {
    await runPipeline(invoiceId);
  } finally {
    inFlight.delete(invoiceId);
  }
}

async function runPipeline(invoiceId) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  let extraction;
  try {
    extraction = await aiServiceClient.withRetry(() =>
      aiServiceClient.extractInvoiceData(invoice.documentUrl, invoice.vendorId),
    );
  } catch (err) {
    logger.error(`AI extraction failed for invoice ${invoiceId}`, err.message);
    await prisma.aIExtraction.upsert({
      where: { invoiceId },
      update: { errorMessage: err.message },
      create: { invoiceId, extractedData: {}, errorMessage: err.message },
    });
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'PENDING_REVIEW' } });
    return;
  }

  await prisma.aIExtraction.upsert({
    where: { invoiceId },
    update: {
      extractedData: extraction.extractedData,
      confidence: extraction.confidence,
      modelName: extraction.modelName,
      processingTime: extraction.processingTimeMs,
      ocrRawText: extraction.ocrText,
    },
    create: {
      invoiceId,
      extractedData: extraction.extractedData,
      confidence: extraction.confidence,
      modelName: extraction.modelName,
      processingTime: extraction.processingTimeMs,
      ocrRawText: extraction.ocrText,
    },
  });

  const duplicates = await findFuzzyDuplicates({
    vendorId: invoice.vendorId,
    totalAmount: invoice.totalAmount,
    invoiceDate: invoice.invoiceDate,
    excludeInvoiceId: invoice.id,
  });

  const matchResult = await matchInvoice(invoiceId);

  let risk;
  try {
    risk = await aiServiceClient.withRetry(() =>
      aiServiceClient.assessRisk({
        invoice: {
          id: invoice.id,
          totalAmount: Number(invoice.totalAmount),
          vendorId: invoice.vendorId,
        },
        extraction: { confidence: extraction.confidence, extractedData: extraction.extractedData },
        matchStatus: matchResult.matchStatus,
        duplicateCount: duplicates.length,
      }),
    );
  } catch (err) {
    logger.error(`AI risk assessment failed for invoice ${invoiceId}`, err.message);
    risk = { riskScore: 50, riskLevel: 'MEDIUM', reasons: ['Risk assessment service unavailable'] };
  }

  await prisma.aIRiskAssessment.upsert({
    where: { invoiceId },
    update: { riskScore: risk.riskScore, riskLevel: risk.riskLevel, reasons: risk.reasons, modelName: risk.modelName },
    create: {
      invoiceId,
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      reasons: risk.reasons,
      modelName: risk.modelName,
    },
  });

  const lowConfidence = (extraction.confidence ?? 0) < CONFIDENCE_THRESHOLD;
  const highRisk = risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL';
  const hasFuzzyDuplicates = duplicates.length > 0;
  const isMismatched = matchResult.matchStatus === 'MISMATCHED';

  // AI output never auto-approves; low confidence, high risk, duplicates, or a
  // failed match always route to a human, per the human-in-the-loop requirement.
  const nextStatus = lowConfidence || highRisk || hasFuzzyDuplicates || isMismatched
    ? 'PENDING_REVIEW'
    : 'PENDING_APPROVAL';

  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: nextStatus } });

  if (nextStatus === 'PENDING_APPROVAL') {
    notificationService.notify('INVOICE_PENDING_APPROVAL', { invoiceId, invoiceNumber: invoice.invoiceNumber });
  }

  await recordAudit({
    action: 'INVOICE_PROCESSED',
    entity: 'Invoice',
    entityId: invoiceId,
    invoiceId,
    metadata: { nextStatus, matchStatus: matchResult.matchStatus, riskLevel: risk.riskLevel, confidence: extraction.confidence },
  });
}

module.exports = { processInvoice, CONFIDENCE_THRESHOLD };
