const logger = require('../config/logger');

let invoiceQueue = null;

if (process.env.REDIS_URL) {
  // eslint-disable-next-line global-require
  const { Queue } = require('bullmq');
  invoiceQueue = new Queue('invoice-processing', { connection: { url: process.env.REDIS_URL } });
}

// jobId defaults to a stable key derived from the invoice + a processing "round" so an
// accidental double-submit (double-click upload, a retried HTTP request) can't enqueue
// the same round twice — BullMQ rejects re-adding a jobId that's already
// waiting/active/delayed. Pass a fresh `round` (e.g. Date.now()) for an intentional
// reprocess so it isn't deduped against a prior, already-finished run.
async function enqueueInvoiceProcessing(invoiceId, { round = 0 } = {}) {
  const jobId = `invoice-${invoiceId}-${round}`;

  if (invoiceQueue) {
    await invoiceQueue.add(
      'process-invoice',
      { invoiceId },
      { jobId, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 1000 },
    );
    return;
  }

  // No Redis configured (local dev without the worker service running): process
  // inline instead of dropping the job, so the pipeline still runs end-to-end.
  logger.warn(`REDIS_URL not set — processing invoice ${invoiceId} inline instead of via queue`);
  setImmediate(async () => {
    try {
      // eslint-disable-next-line global-require
      const { processInvoice } = require('../modules/invoiceProcessing/processInvoice');
      await processInvoice(invoiceId);
    } catch (err) {
      logger.error({ err }, `Inline invoice processing failed for ${invoiceId}`);
    }
  });
}

module.exports = { enqueueInvoiceProcessing };
