require('dotenv').config();
const { startInvoiceWorker } = require('./queues/invoiceQueue');

startInvoiceWorker(console);
console.log('Worker started, listening on queue "invoice-processing"');
