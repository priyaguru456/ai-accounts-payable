const path = require('path');
// Reuses the backend's invoice-processing pipeline directly rather than duplicating
// it, since worker and backend share the same Prisma schema/DB and domain logic.
const { processInvoice } = require(path.join('..', '..', '..', 'backend', 'src', 'modules', 'invoiceProcessing', 'processInvoice'));

module.exports = async function processInvoiceJob(job) {
  const { invoiceId } = job.data;
  await processInvoice(invoiceId);
};
