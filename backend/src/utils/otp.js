const crypto = require('crypto');

const OTP_TTL_MS = 10 * 60 * 1000;

function generateOtp() {
  // 6-digit numeric code, zero-padded. crypto.randomInt is rejection-sampled so this
  // is uniform, unlike Math.random()-based approaches.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

module.exports = { generateOtp, hashOtp, OTP_TTL_MS };
