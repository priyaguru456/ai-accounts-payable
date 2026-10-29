const express = require('express');
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const validate = require('../utils/validators/validate');
const { registerSchema, loginSchema, verifyOtpSchema } = require('../utils/validators/auth.validators');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', auth, authController.me);
router.post('/mfa/enable', auth, authController.enableMfa);
router.post('/mfa/disable', auth, authController.disableMfa);

module.exports = router;
