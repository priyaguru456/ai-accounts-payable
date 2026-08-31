const { Queue, Worker } = require('bullmq');
const connection = require('./connection');
const verifyAuditChainJob = require('../jobs/verifyAuditChain.job');

const AUDIT_CHAIN_CHECK_CRON = process.env.AUDIT_CHAIN_CHECK_CRON || '0 3 * * *'; // daily at 03:00

async function scheduleMaintenanceJobs() {
  const queue = new Queue('maintenance', { connection });
  await queue.add(
    'verify-audit-chain',
    {},
    { repeat: { pattern: AUDIT_CHAIN_CHECK_CRON }, jobId: 'verify-audit-chain-scheduled' },
  );
  return queue;
}

function startMaintenanceWorker(logger) {
  const worker = new Worker(
    'maintenance',
    async (job) => {
      if (job.name === 'verify-audit-chain') {
        const result = await verifyAuditChainJob();
        if (!result.valid) {
          logger.error(`[worker] audit chain verification FAILED at entry ${result.brokenAt}`);
        } else {
          logger.log('[worker] audit chain verification passed');
        }
        return result;
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => logger.error(`[worker] maintenance job ${job?.id} failed:`, err));

  return worker;
}

module.exports = { scheduleMaintenanceJobs, startMaintenanceWorker };
