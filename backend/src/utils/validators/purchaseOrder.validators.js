const { z } = require('zod');

const poItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const createPurchaseOrderSchema = z.object({
  poNumber: z.string().min(1),
  vendorId: z.string().min(1),
  orderDate: z.coerce.date(),
  items: z.array(poItemSchema).min(1),
});

const updatePurchaseOrderSchema = z.object({
  orderDate: z.coerce.date().optional(),
});

const goodsReceiptItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
});

const createGoodsReceiptSchema = z.object({
  receiptNumber: z.string().min(1),
  purchaseOrderId: z.string().min(1),
  receivedDate: z.coerce.date(),
  items: z.array(goodsReceiptItemSchema).min(1),
});

module.exports = {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  createGoodsReceiptSchema,
};
