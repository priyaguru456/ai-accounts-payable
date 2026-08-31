const express = require('express');
const controller = require('../controllers/invoices.controller');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { uploadLimiter } = require('../middleware/rateLimit');
const { upload } = require('../middleware/upload');
const validate = require('../utils/validators/validate');
const { uploadInvoiceMetaSchema } = require('../utils/validators/invoice.validators');

const router = express.Router();

router.use(auth);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post(
  '/upload',
  rbac('ADMIN', 'AP_SPECIALIST'),
  uploadLimiter,
  upload.single('document'),
  validate(uploadInvoiceMetaSchema),
  controller.upload,
);
router.post('/:id/reprocess', rbac('ADMIN', 'AP_SPECIALIST'), controller.reprocess);
router.post('/:id/match', rbac('ADMIN', 'AP_SPECIALIST'), controller.manualMatch);

module.exports = router;
