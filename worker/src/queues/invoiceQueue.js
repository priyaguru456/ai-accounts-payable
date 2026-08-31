const { Worker } = require('bullmq');
const connection = require('./connection');
const processInvoiceJob = require('../jobs/processInvoice.job');

function startInvoiceWorker(logger) {
  const worker = new Worker('invoice-processing', processInvoiceJob, { connection });

  worker.on('completed', (job) => logger.log(`[worker] invoice job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`[worker] invoice job ${job?.id} failed:`, err));

  return worker;
}

module.exports = { startInvoiceWorker };
