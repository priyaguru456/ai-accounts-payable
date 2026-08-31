require('dotenv').config();

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is required to run the worker service');
}

module.exports = { url: process.env.REDIS_URL };
