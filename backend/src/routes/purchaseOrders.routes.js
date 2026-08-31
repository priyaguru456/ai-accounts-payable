const express = require('express');
const controller = require('../controllers/purchaseOrders.controller');
const goodsReceiptsController = require('../controllers/goodsReceipts.controller');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../utils/validators/validate');
const {
  createPurchaseOrderSchema,
  createGoodsReceiptSchema,
} = require('../utils/validators/purchaseOrder.validators');
const { z } = require('zod');

const router = express.Router();

router.use(auth);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', rbac('ADMIN', 'AP_SPECIALIST'), validate(createPurchaseOrderSchema), controller.create);
router.post(
  '/:id/items',
  rbac('ADMIN', 'AP_SPECIALIST'),
  validate(z.object({ items: createPurchaseOrderSchema.shape.items })),
  controller.addItems,
);
router.post(
  '/goods-receipts',
  rbac('ADMIN', 'AP_SPECIALIST'),
  validate(createGoodsReceiptSchema),
  goodsReceiptsController.create,
);

module.exports = router;
