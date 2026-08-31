const logger = require('../config/logger');

// Virus-scan seam for uploaded invoice documents. If CLAMAV_HOST is set and the
// optional `clamscan` dependency is installed, scans via clamd. If CLAMAV_HOST is
// unset entirely, this is a safe no-op (returns clean) so local dev works without
// ClamAV installed. But once CLAMAV_HOST IS set — meaning a scanner is expected in
// this environment — any failure to init or scan fails CLOSED (upload rejected)
// rather than silently falling back to "clean": an operator who configured a scanner
// is trusting it to actually run, not to degrade into a no-op on an outage.
let scanner = null;
let initPromise = null;

async function getScanner() {
  if (!initPromise) {
    initPromise = (async () => {
      // eslint-disable-next-line global-require
      const NodeClam = require('clamscan');
      scanner = await new NodeClam().init({
        clamdscan: { host: process.env.CLAMAV_HOST, port: Number(process.env.CLAMAV_PORT) || 3310 },
      });
    })();
  }
  await initPromise;
  return scanner;
}

async function scanBuffer(buffer, filename) {
  if (!process.env.CLAMAV_HOST) {
    return { clean: true, scanned: false };
  }

  try {
    const client = await getScanner();
    const { isInfected, viruses } = await client.scanStream(bufferToStream(buffer));
    if (isInfected) {
      logger.error(`Virus scan flagged upload ${filename}: ${viruses.join(', ')}`);
    }
    return { clean: !isInfected, scanned: true, viruses };
  } catch (err) {
    logger.error(`Virus scan failed for upload ${filename} (CLAMAV_HOST is configured, failing closed): ${err.message}`);
    // Reset so a transient outage doesn't permanently wedge every future upload behind
    // one cached failed init attempt — the next upload gets a fresh init try.
    initPromise = null;
    return { clean: false, scanned: false, error: err.message };
  }
}

function bufferToStream(buffer) {
  const { Readable } = require('stream');
  return Readable.from(buffer);
}

module.exports = { scanBuffer };
