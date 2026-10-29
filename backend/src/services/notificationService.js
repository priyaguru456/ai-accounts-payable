const axios = require('axios');
const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const MESSAGES = {
  INVOICE_PENDING_APPROVAL: ({ invoiceNumber }) => `Invoice ${invoiceNumber} is awaiting approval.`,
  INVOICE_APPROVED: ({ invoiceNumber }) => `Invoice ${invoiceNumber} was approved.`,
  INVOICE_REJECTED: ({ invoiceNumber, comments }) => `Invoice ${invoiceNumber} was rejected.${comments ? ` Reason: ${comments}` : ''}`,
  PAYMENT_COMPLETED: ({ invoiceNumber, amount }) => `Payment of ${amount} completed for invoice ${invoiceNumber}.`,
  AUDIT_CHAIN_BROKEN: ({ brokenAt }) =>
    `SECURITY ALERT: audit log hash chain is broken at entry ${brokenAt}. An audit log row may have been edited or deleted outside normal application writes. Investigate immediately.`,
  VENDOR_BANK_DETAILS_CHANGED: ({ vendorName }) =>
    `SECURITY ALERT: bank account/IFSC details were changed for vendor "${vendorName}". Verify this change with the vendor through a known channel before any future payment.`,
  OTP_LOGIN_CODE: ({ otp }) => `Your login verification code is ${otp}. It expires in 10 minutes. Do not share this code.`,
};

// These events are security-sensitive enough to warrant emailing/webhooking even
// when they aren't a per-user action (e.g. no single "recipient" like an OTP code) —
// everything else only goes to Slack/log to avoid spamming an ops inbox.
const HIGH_SEVERITY_EVENTS = new Set(['AUDIT_CHAIN_BROKEN', 'VENDOR_BANK_DETAILS_CHANGED']);

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.EMAIL_SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port: Number(process.env.EMAIL_SMTP_PORT) || 587,
    secure: process.env.EMAIL_SMTP_SECURE === 'true',
    auth: process.env.EMAIL_SMTP_USER
      ? { user: process.env.EMAIL_SMTP_USER, pass: process.env.EMAIL_SMTP_PASSWORD }
      : undefined,
  });
  return transporter;
}

// Sends a plain-text email. No-ops (just logs) when EMAIL_SMTP_HOST isn't configured,
// matching the Slack no-op pattern below, so local dev never needs real SMTP creds.
async function sendEmail(to, subject, message) {
  if (!to) return;
  const client = getTransporter();
  if (!client) {
    logger.info(`[email:skip-no-smtp] to=${to} subject="${subject}"`);
    return;
  }
  try {
    await client.sendMail({ from: process.env.EMAIL_FROM || 'no-reply@ap-automation.local', to, subject, text: message });
  } catch (err) {
    logger.warn(`Failed to send email (${subject}) to ${to}: ${err.message}`);
  }
}

// Fires a notification for a key invoice-lifecycle event. If SLACK_WEBHOOK_URL is set,
// posts there; if EMAIL_NOTIFY_TO is set, high-severity events also go there; if
// WEBHOOK_URL is set, every event is also POSTed there for downstream/ERP integrations.
// Any of these being unset makes that channel a safe no-op, so nothing needs to be
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
  } else {
    try {
      await axios.post(process.env.SLACK_WEBHOOK_URL, { text: message });
    } catch (err) {
      logger.warn(`Failed to send Slack notification for ${eventType}: ${err.message}`);
    }
  }

  if (process.env.EMAIL_NOTIFY_TO && HIGH_SEVERITY_EVENTS.has(eventType)) {
    await sendEmail(process.env.EMAIL_NOTIFY_TO, `[AP Automation] ${eventType}`, message);
  }

  if (process.env.WEBHOOK_URL) {
    try {
      await axios.post(process.env.WEBHOOK_URL, { event: eventType, message, context, timestamp: new Date().toISOString() });
    } catch (err) {
      logger.warn(`Failed to POST outbound webhook for ${eventType}: ${err.message}`);
    }
  }
}

module.exports = { notify, sendEmail };
