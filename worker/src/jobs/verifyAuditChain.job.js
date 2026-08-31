const path = require('path');
const { verifyChain } = require(path.join('..', '..', '..', 'backend', 'src', 'utils', 'auditLogger'));
const notificationService = require(path.join('..', '..', '..', 'backend', 'src', 'services', 'notificationService'));

// Runs verifyChain() (see backend/src/utils/auditLogger.js) and alerts if the
// hash-chain is broken anywhere — which would mean an AuditLog row was edited or
// deleted outside of normal application writes. Scheduled by invoiceQueue.js's
// repeatable job below; can also be invoked ad hoc via runVerifyAuditChainJob().
async function runVerifyAuditChainJob() {
  const result = await verifyChain();

  if (!result.valid) {
    await notificationService.notify('AUDIT_CHAIN_BROKEN', { brokenAt: result.brokenAt });
  }

  return result;
}

module.exports = runVerifyAuditChainJob;
