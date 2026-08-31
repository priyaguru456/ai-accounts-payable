const logger = require('./logger');

// Minimal error-tracking seam: if SENTRY_DSN is set and @sentry/node is installed,
// forward errors there; otherwise this is a safe no-op so the app runs identically
// without any error-tracking account configured.
let sentry = null;

if (process.env.SENTRY_DSN) {
  try {
    // eslint-disable-next-line global-require
    sentry = require('@sentry/node');
    sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
    logger.info('Error tracking enabled (Sentry)');
  } catch (err) {
    logger.warn('SENTRY_DSN is set but @sentry/node is not installed; skipping error tracking');
  }
}

function captureException(err, context) {
  if (sentry) {
    sentry.captureException(err, { extra: context });
  }
}

module.exports = { captureException };
