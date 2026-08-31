const { AsyncLocalStorage } = require('async_hooks');
const { randomUUID } = require('crypto');
const pinoHttp = require('pino-http');
const logger = require('../config/logger');

const als = new AsyncLocalStorage();

function getCorrelationId() {
  return als.getStore()?.correlationId;
}

// Propagates a correlation id across backend -> worker -> ai-service so a single
// invoice-processing request can be traced through logs in all three services
// without a full OpenTelemetry collector (see docs/observability.md).
function requestContext(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || randomUUID();
  res.setHeader('x-correlation-id', correlationId);
  als.run({ correlationId }, () => next());
}

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-correlation-id'] || randomUUID(),
  customProps: () => ({ correlationId: getCorrelationId() }),
});

module.exports = { requestContext, httpLogger, getCorrelationId, als };
