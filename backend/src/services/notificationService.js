const axios = require('axios');
const logger = require('../config/logger');

const MESSAGES = {
  INVOICE_PENDING_APPROVAL: ({ invoiceNumber }) => `Invoice ${invoiceNumber} is awaiting approval.`,
  INVOICE_APPROVED: ({ invoiceNumber }) => `Invoice ${invoiceNumber} was approved.`,
  INVOICE_REJECTED: ({ invoiceNumber, comments }) => `Invoice ${invoiceNumber} was rejected.${comments ? ` Reason: ${comments}` : ''}`,
  PAYMENT_COMPLETED: ({ invoiceNumber, amount }) => `Payment of ${amount} completed for invoice ${invoiceNumber}.`,
};

// Fires a notification for a key invoice-lifecycle event. If SLACK_WEBHOOK_URL is set,
// posts there; otherwise this is a safe no-op (just logs), so nothing needs to be
// configured for local dev or for the rest of the pipeline to keep working.
async function notify(eventType, context) {
  const buildMessage = MESSAGES[eventType];
  if (!buildMessage) {
    logger.warn(`notificationService.notify called with unknown eventType: ${eventType}`);
    return;
  }
  const message = buildMessage(context);

  if (!process.env.SLACK_WEBHOOK_URL) {
    logger.info(`[notification:${eventType}] ${message}`);
    return;
  }

  try {
    await axios.post(process.env.SLACK_WEBHOOK_URL, { text: message });
  } catch (err) {
    logger.warn(`Failed to send Slack notification for ${eventType}: ${err.message}`);
  }
}

module.exports = { notify };
