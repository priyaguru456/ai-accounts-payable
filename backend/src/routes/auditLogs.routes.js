const express = require('express');
const controller = require('../controllers/auditLogs.controller');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

const router = express.Router();

router.use(auth);
router.get('/', rbac('ADMIN', 'AUDITOR'), controller.list);
router.get('/verify', rbac('ADMIN', 'AUDITOR'), controller.verify);

module.exports = router;
