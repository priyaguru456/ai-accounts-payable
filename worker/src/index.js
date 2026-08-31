require('dotenv').config();
const { startInvoiceWorker } = require('./queues/invoiceQueue');
const { scheduleMaintenanceJobs, startMaintenanceWorker } = require('./queues/maintenanceQueue');

startInvoiceWorker(console);
console.log('Worker started, listening on queue "invoice-processing"');

startMaintenanceWorker(console);
scheduleMaintenanceJobs()
  .then(() => console.log('Maintenance worker started; audit-chain verification scheduled'))
  .catch((err) => console.error('Failed to schedule maintenance jobs:', err));
