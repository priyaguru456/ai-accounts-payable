const express = require('express');
const controller = require('../controllers/payments.controller');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../utils/validators/validate');
const { createPaymentSchema, updatePaymentSchema } = require('../utils/validators/payment.validators');

const router = express.Router();

router.use(auth);

router.get('/', controller.list);
router.post('/invoices/:id', rbac('ADMIN', 'FINANCE_MANAGER'), validate(createPaymentSchema), controller.create);
router.patch('/:id', rbac('ADMIN', 'FINANCE_MANAGER'), validate(updatePaymentSchema), controller.update);

module.exports = router;
