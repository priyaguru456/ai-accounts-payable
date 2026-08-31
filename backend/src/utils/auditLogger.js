const crypto = require('crypto');
const prisma = require('../config/prisma');
const logger = require('../config/logger');

// Hash-chains each audit entry to its predecessor (like a mini blockchain) so any
// tampering with, or deletion of, a past entry breaks the chain and is detectable via
// verifyChain() below. Stored inside the existing `metadata` JSON column (as
// `_integrity`) rather than new schema columns, since AuditLog.metadata is already Json.
let lastHash = null;

function computeHash({ action, entity, entityId, userId, invoiceId, metadata, prevHash }) {
  const payload = JSON.stringify({ action, entity, entityId, userId, invoiceId, metadata, prevHash });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function getLastHash() {
  if (lastHash !== null) return lastHash;
  const last = await prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' } });
  lastHash = last?.metadata?._integrity?.hash || null;
  return lastHash;
}

async function recordAudit({ action, entity, entityId, userId, invoiceId, metadata }) {
  try {
    const prevHash = await getLastHash();
    const hash = computeHash({ action, entity, entityId, userId, invoiceId, metadata, prevHash });

    const created = await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        userId,
        invoiceId,
        metadata: { ...(metadata || {}), _integrity: { prevHash, hash } },
      },
    });

    lastHash = hash;
    return created;
  } catch (err) {
    logger.error({ err }, 'Failed to write audit log');
    return null;
  }
}

// Walks the full audit log in chronological order and recomputes each hash to confirm
// no entry was altered or removed out-of-band. Returns { valid, brokenAt? }.
async function verifyChain() {
  const entries = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
  let expectedPrevHash = null;

  for (const entry of entries) {
    const { _integrity, ...metadata } = entry.metadata || {};
    const recomputed = computeHash({
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      userId: entry.userId,
      invoiceId: entry.invoiceId,
      metadata,
      prevHash: expectedPrevHash,
    });

    if (!_integrity || _integrity.prevHash !== expectedPrevHash || _integrity.hash !== recomputed) {
      return { valid: false, brokenAt: entry.id };
    }
    expectedPrevHash = _integrity.hash;
  }

  return { valid: true };
}

module.exports = { recordAudit, verifyChain };
