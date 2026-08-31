const crypto = require('crypto');
const logger = require('../config/logger');

const ALGORITHM = 'aes-256-gcm';
const key = process.env.FIELD_ENCRYPTION_KEY ? Buffer.from(process.env.FIELD_ENCRYPTION_KEY, 'hex') : null;

let warned = false;
function warnOnce() {
  if (!warned) {
    logger.warn('FIELD_ENCRYPTION_KEY is not set — vendor bank fields will be stored in plaintext. Set it before handling real vendor data.');
    warned = true;
  }
}

// Encrypts sensitive vendor fields (bank account, IFSC) at rest with AES-256-GCM.
// No-ops (stores plaintext) when FIELD_ENCRYPTION_KEY isn't configured, so local dev
// works without any extra setup — but a warning is logged so it's not silently insecure.
function encryptField(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;
  if (!key) {
    warnOnce();
    return plaintext;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptField(value) {
  if (value == null || !String(value).startsWith('enc:')) return value;
  if (!key) return value; // can't decrypt without the key; caller should treat as opaque

  const [, ivB64, authTagB64, dataB64] = value.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encryptField, decryptField };
