const express = require('express');
const controller = require('../controllers/vendors.controller');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../utils/validators/validate');
const { createVendorSchema, updateVendorSchema } = require('../utils/validators/vendor.validators');

const router = express.Router();

router.use(auth);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', rbac('ADMIN', 'AP_SPECIALIST'), validate(createVendorSchema), controller.create);
router.patch('/:id', rbac('ADMIN', 'AP_SPECIALIST'), validate(updateVendorSchema), controller.update);
router.delete('/:id', rbac('ADMIN'), controller.remove);

module.exports = router;
