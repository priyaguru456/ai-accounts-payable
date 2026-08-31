const prisma = require('../config/prisma');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAudit } = require('../utils/auditLogger');

const create = asyncHandler(async (req, res) => {
  const { receiptNumber, purchaseOrderId, receivedDate, items } = req.body;

  const purchaseOrder = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
  if (!purchaseOrder) throw ApiError.notFound('Purchase order not found');

  const goodsReceipt = await prisma.goodsReceipt.create({
    data: {
      receiptNumber,
      purchaseOrderId,
      receivedDate,
      items: { create: items },
    },
    include: { items: true },
  });

  await recordAudit({ action: 'GOODS_RECEIPT_CREATED', entity: 'GoodsReceipt', entityId: goodsReceipt.id, userId: req.user.id });
  res.status(201).json({ goodsReceipt });
});

module.exports = { create };
