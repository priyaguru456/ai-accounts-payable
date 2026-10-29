const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'AP_SPECIALIST', 'FINANCE_MANAGER', 'APPROVER', 'AUDITOR']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyOtpSchema = z.object({
  userId: z.string().min(1),
  otp: z.string().length(6),
});

module.exports = { registerSchema, loginSchema, verifyOtpSchema };
