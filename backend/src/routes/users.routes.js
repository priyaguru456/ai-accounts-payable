const express = require('express');
const controller = require('../controllers/users.controller');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../utils/validators/validate');
const { z } = require('zod');

const router = express.Router();

router.use(auth, rbac('ADMIN'));

router.get('/', controller.list);
router.patch(
  '/:id',
  validate(z.object({
    role: z.enum(['ADMIN', 'AP_SPECIALIST', 'FINANCE_MANAGER', 'APPROVER', 'AUDITOR']).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })),
  controller.update,
);

module.exports = router;
