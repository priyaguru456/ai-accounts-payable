const prisma = require('../../config/prisma');

const AMOUNT_TOLERANCE = 0.01; // 1%
const DATE_PROXIMITY_DAYS = 3;

// Exact duplicates are already prevented by the @@unique([vendorId, invoiceNumber])
// constraint on Invoice. This flags *fuzzy* duplicates: same vendor, similar amount,
// invoice date within a few days of an existing invoice.
async function findFuzzyDuplicates({ vendorId, totalAmount, invoiceDate, excludeInvoiceId }) {
  const from = new Date(invoiceDate);
  from.setDate(from.getDate() - DATE_PROXIMITY_DAYS);
  const to = new Date(invoiceDate);
  to.setDate(to.getDate() + DATE_PROXIMITY_DAYS);

  const amount = Number(totalAmount);
  const minAmount = amount * (1 - AMOUNT_TOLERANCE);
  const maxAmount = amount * (1 + AMOUNT_TOLERANCE);

  const candidates = await prisma.invoice.findMany({
    where: {
      vendorId,
      invoiceDate: { gte: from, lte: to },
      totalAmount: { gte: minAmount, lte: maxAmount },
      ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
    },
  });

  return candidates;
}

module.exports = { findFuzzyDuplicates };
