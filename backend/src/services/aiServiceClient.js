const axios = require('axios');
const env = require('../config/env');
const logger = require('../config/logger');
const { getCorrelationId } = require('../middleware/requestContext');

const client = axios.create({
  baseURL: env.aiServiceUrl,
  timeout: 30000,
  headers: { 'X-Internal-Key': env.aiServiceInternalKey },
});

client.interceptors.request.use((config) => {
  const correlationId = getCorrelationId();
  if (correlationId) config.headers['x-correlation-id'] = correlationId;
  return config;
});

// Simple per-process circuit breaker: after CIRCUIT_FAILURE_THRESHOLD consecutive
// failures, calls short-circuit for CIRCUIT_COOLDOWN_MS instead of hammering an ai-service
// that's already down, then probe again automatically.
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 30_000;
let consecutiveFailures = 0;
let circuitOpenedAt = null;

function circuitIsOpen() {
  if (!circuitOpenedAt) return false;
  if (Date.now() - circuitOpenedAt > CIRCUIT_COOLDOWN_MS) {
    circuitOpenedAt = null;
    consecutiveFailures = 0;
    return false;
  }
  return true;
}

function recordSuccess() {
  consecutiveFailures = 0;
  circuitOpenedAt = null;
}

function recordFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD && !circuitOpenedAt) {
    circuitOpenedAt = Date.now();
    logger.error('AI service circuit breaker opened after repeated failures');
  }
}

async function extractInvoiceData(documentUrl, vendorId) {
  const { data } = await client.post('/extract', { documentUrl, vendorId });
  return data;
}

async function assessRisk(payload) {
  const { data } = await client.post('/assess-risk', payload);
  return data;
}

// Feeds an approved invoice's extraction back into the AI service's per-vendor RAG
// store (see ai-service/app/services/rag_service.py). Best-effort: a failure here
// must never block the approval flow itself.
async function submitRagExample({ vendorId, ocrText, extractedData }) {
  if (!ocrText) return;
  try {
    await client.post('/rag/examples', { vendorId, ocrText, extractedData });
  } catch (err) {
    logger.warn(`Failed to submit RAG example for vendor ${vendorId}: ${err.message}`);
  }
}

async function withRetry(fn, retries = 2) {
  if (circuitIsOpen()) {
    throw new Error('AI service circuit breaker is open; skipping call');
  }

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await fn();
      recordSuccess();
      return result;
    } catch (err) {
      lastErr = err;
      logger.warn(`AI service call failed (attempt ${attempt + 1}/${retries + 1}): ${err.message}`);
    }
  }
  recordFailure();
  throw lastErr;
}

module.exports = { extractInvoiceData, assessRisk, withRetry, submitRagExample };
