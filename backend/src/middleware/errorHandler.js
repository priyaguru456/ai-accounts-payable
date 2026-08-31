const ApiError = require('../utils/apiError');
const logger = require('../config/logger');
const { captureException } = require('../config/errorTracking');

module.exports = function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) captureException(err, { path: req.path });
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  logger.error({ err }, 'Unhandled error');
  captureException(err, { path: req.path });
  res.status(500).json({ error: 'Internal server error' });
};
