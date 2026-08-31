const required = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// FIELD_ENCRYPTION_KEY is optional in dev (fieldEncryption.js falls back to plaintext
// with a warning) but must never be silently skipped in a real environment — vendor
// bank details would end up stored unencrypted. Refuse to boot instead.
if (process.env.NODE_ENV === 'production' && !process.env.FIELD_ENCRYPTION_KEY) {
  throw new Error(
    'FIELD_ENCRYPTION_KEY is required when NODE_ENV=production — vendor bank account/IFSC fields ' +
      'would otherwise be stored in plaintext. Generate one with: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  aiServiceInternalKey: process.env.AI_SERVICE_INTERNAL_KEY || '',
};
