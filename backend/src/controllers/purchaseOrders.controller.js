const prisma = require('../config/prisma');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAudit } = require('../utils/auditLogger');

function computeItemAmounts(items) {
  return items.map((item) => ({
    ...item,
    amount: Number((item.quantity * item.unitPrice).toFixed(2)),
  }));
}

const list = asyncHandler(async (req, res) => {
  const { vendorId } = req.query;
  const where = vendorId ? { vendorId } : {};
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where,
    include: { vendor: true, items: true },
    orderBy: { orderDate: 'desc' },
  });
  res.json({ purchaseOrders });
});

const getById = asyncHandler(async (req, res) => {
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: req.params.id },
    include: { vendor: true, items: true, goodsReceipts: { include: { items: true } }, invoices: true },
  });
  if (!purchaseOrder) throw ApiError.notFound('Purchase order not found');
  res.json({ purchaseOrder });
});

const create = asyncHandler(async (req, res) => {
  const { poNumber, vendorId, orderDate, items } = req.body;
  const itemsWithAmounts = computeItemAmounts(items);
  const totalAmount = itemsWithAmounts.reduce((sum, item) => sum + item.amount, 0);

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      vendorId,
      orderDate,
      totalAmount,
      items: { create: itemsWithAmounts },
    },
    include: { items: true },
  });

  await recordAudit({ action: 'PO_CREATED', entity: 'PurchaseOrder', entityId: purchaseOrder.id, userId: req.user.id });
  res.status(201).json({ purchaseOrder });
});

const addItems = asyncHandler(async (req, res) => {
  const purchaseOrder = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
  if (!purchaseOrder) throw ApiError.notFound('Purchase order not found');

  const items = computeItemAmounts(req.body.items);
  await prisma.purchaseOrderItem.createMany({
    data: items.map((item) => ({ ...item, purchaseOrderId: purchaseOrder.id })),
  });

  const addedTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const updated = await prisma.purchaseOrder.update({
    where: { id: purchaseOrder.id },
    data: { totalAmount: { increment: addedTotal } },
    include: { items: true },
  });

  await recordAudit({ action: 'PO_ITEMS_ADDED', entity: 'PurchaseOrder', entityId: purchaseOrder.id, userId: req.user.id });
  res.status(201).json({ purchaseOrder: updated });
});

module.exports = { list, getById, create, addItems };
