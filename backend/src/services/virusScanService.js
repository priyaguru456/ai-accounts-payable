const logger = require('../config/logger');

// Virus-scan seam for uploaded invoice documents. If CLAMAV_HOST is set and the
// optional `clamscan` dependency is installed, scans via clamd; otherwise this is a
// safe no-op (returns clean) so local dev works without ClamAV installed. Wire a real
// ClamAV daemon (sidecar container or AWS-native scanning) before handling real uploads
// in production — see infrastructure/aws/README.md.
let scanner = null;
let initPromise = null;

async function getScanner() {
  if (!process.env.CLAMAV_HOST) return null;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        // eslint-disable-next-line global-require
        const NodeClam = require('clamscan');
        scanner = await new NodeClam().init({
          clamdscan: { host: process.env.CLAMAV_HOST, port: Number(process.env.CLAMAV_PORT) || 3310 },
        });
      } catch (err) {
        logger.warn(`CLAMAV_HOST is set but the clamscan client could not initialize: ${err.message}`);
        scanner = null;
      }
    })();
  }
  await initPromise;
  return scanner;
}

async function scanBuffer(buffer, filename) {
  const client = await getScanner();
  if (!client) {
    return { clean: true, scanned: false };
  }

  const { isInfected, viruses } = await client.scanStream(bufferToStream(buffer));
  if (isInfected) {
    logger.error(`Virus scan flagged upload ${filename}: ${viruses.join(', ')}`);
  }
  return { clean: !isInfected, scanned: true, viruses };
}

function bufferToStream(buffer) {
  const { Readable } = require('stream');
  return Readable.from(buffer);
}

module.exports = { scanBuffer };
