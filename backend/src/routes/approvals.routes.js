const express = require('express');
const controller = require('../controllers/approvals.controller');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../utils/validators/validate');
const { approvalActionSchema } = require('../utils/validators/invoice.validators');

const router = express.Router();

router.use(auth);

router.get('/pending', rbac('ADMIN', 'FINANCE_MANAGER', 'APPROVER'), controller.pending);
router.post(
  '/invoices/:id',
  rbac('ADMIN', 'FINANCE_MANAGER', 'APPROVER'),
  validate(approvalActionSchema),
  controller.act,
);

module.exports = router;
