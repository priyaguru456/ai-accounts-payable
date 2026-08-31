const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../config/logger');

// Storage driver selection: defaults to local disk (works with zero AWS setup).
// Set STORAGE_DRIVER=s3 + AWS_* env vars to switch to real S3 — no caller changes
// needed since both drivers expose the same saveInvoiceDocument/getInvoiceDocumentUrl shape.
const DRIVER = process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local';

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (DRIVER === 'local' && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

let s3Client = null;
let getSignedUrl = null;
let PutObjectCommand = null;
let GetObjectCommand = null;

function loadS3() {
  if (s3Client) return;
  // eslint-disable-next-line global-require
  const { S3Client, PutObjectCommand: Put, GetObjectCommand: Get } = require('@aws-sdk/client-s3');
  // eslint-disable-next-line global-require
  const { getSignedUrl: sign } = require('@aws-sdk/s3-request-presigner');
  s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  getSignedUrl = sign;
  PutObjectCommand = Put;
  GetObjectCommand = Get;
}

async function saveInvoiceDocument(fileBuffer, originalName) {
  const ext = path.extname(originalName);
  const key = `${crypto.randomUUID()}${ext}`;

  if (DRIVER === 's3') {
    loadS3();
    await s3Client.send(
      new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: fileBuffer, ServerSideEncryption: 'AES256' }),
    );
    logger.info(`Stored invoice document in S3: ${key}`);
    return { key, url: `s3://${process.env.S3_BUCKET}/${key}` };
  }

  await fs.promises.writeFile(path.join(UPLOAD_DIR, key), fileBuffer);
  return { key, url: `/uploads/${key}` };
}

// Returns a URL the ai-service (or a browser) can fetch the document from. For S3 this
// is a short-lived presigned URL; for local disk it's the static path already stored.
async function getInvoiceDocumentUrl(key) {
  if (DRIVER === 's3') {
    loadS3();
    const command = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key });
    return getSignedUrl(s3Client, command, { expiresIn: 900 });
  }
  return `/uploads/${key}`;
}

async function getInvoiceDocumentPath(key) {
  return path.join(UPLOAD_DIR, key);
}

module.exports = { saveInvoiceDocument, getInvoiceDocumentUrl, getInvoiceDocumentPath, DRIVER };
