const express = require('express');
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const validate = require('../utils/validators/validate');
const { registerSchema, loginSchema } = require('../utils/validators/auth.validators');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', auth, authController.me);

module.exports = router;
