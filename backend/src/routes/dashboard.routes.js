const express = require('express');
const controller = require('../controllers/dashboard.controller');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/summary', controller.summary);
router.get('/risk', controller.risk);

module.exports = router;
