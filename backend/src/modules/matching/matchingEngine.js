const prisma = require('../../config/prisma');

const AMOUNT_TOLERANCE = 0.02; // 2%

function withinTolerance(a, b, tolerance = AMOUNT_TOLERANCE) {
  if (a === 0 && b === 0) return true;
  return Math.abs(a - b) <= Math.max(a, b) * tolerance;
}

// 2-way match: Invoice totals vs PO totals.
// 3-way match: Invoice vs PO vs GoodsReceipt (quantities received must cover invoiced quantities).
async function matchInvoice(invoiceId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, purchaseOrder: { include: { items: true, goodsReceipts: { include: { items: true } } } } },
  });

  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  if (!invoice.purchaseOrder) {
    return persistMatchStatus(invoiceId, 'NOT_CHECKED', { reason: 'No purchase order linked to invoice' });
  }

  const po = invoice.purchaseOrder;
  const discrepancies = [];

  // Amount check (2-way)
  if (!withinTolerance(Number(invoice.totalAmount), Number(po.totalAmount))) {
    discrepancies.push({
      type: 'AMOUNT_MISMATCH',
      invoiceTotal: Number(invoice.totalAmount),
      poTotal: Number(po.totalAmount),
    });
  }

  // Quantity check (3-way), only if goods receipts exist
  const hasGoodsReceipts = po.goodsReceipts.length > 0;
  if (hasGoodsReceipts) {
    const receivedByDescription = {};
    for (const gr of po.goodsReceipts) {
      for (const item of gr.items) {
        receivedByDescription[item.description] = (receivedByDescription[item.description] || 0) + Number(item.quantity);
      }
    }

    for (const invItem of invoice.items) {
      const receivedQty = receivedByDescription[invItem.description] || 0;
      if (receivedQty < Number(invItem.quantity)) {
        discrepancies.push({
          type: 'QUANTITY_SHORT_RECEIPT',
          description: invItem.description,
          invoicedQty: Number(invItem.quantity),
          receivedQty,
        });
      }
    }
  }

  const amountMismatched = discrepancies.some((d) => d.type === 'AMOUNT_MISMATCH');
  const quantityDiscrepancies = discrepancies.filter((d) => d.type === 'QUANTITY_SHORT_RECEIPT');
  const allItemsShortReceived = hasGoodsReceipts && quantityDiscrepancies.length === invoice.items.length;

  let matchStatus;
  if (discrepancies.length === 0) {
    matchStatus = 'MATCHED';
  } else if (amountMismatched || allItemsShortReceived) {
    matchStatus = 'MISMATCHED';
  } else {
    matchStatus = 'PARTIAL';
  }

  return persistMatchStatus(invoiceId, matchStatus, {
    matchType: hasGoodsReceipts ? '3-way' : '2-way',
    discrepancies,
  });
}

async function persistMatchStatus(invoiceId, matchStatus, details) {
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { matchStatus },
  });
  return { invoice, matchStatus, details };
}

module.exports = { matchInvoice };
