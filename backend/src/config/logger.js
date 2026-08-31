const pino = require('pino');

// Structured JSON logging so log lines are queryable in CloudWatch/any log aggregator,
// and carry a correlation id (see middleware/requestContext.js) across a request's
// backend -> worker -> ai-service hops for lightweight distributed tracing.
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
