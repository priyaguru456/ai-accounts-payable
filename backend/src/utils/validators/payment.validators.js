const { z } = require('zod');

const createPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentDate: z.coerce.date().optional(),
  transactionId: z.string().optional(),
  idempotencyKey: z.string().min(1).optional(),
});

const updatePaymentSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  transactionId: z.string().optional(),
  paymentDate: z.coerce.date().optional(),
});

module.exports = { createPaymentSchema, updatePaymentSchema };
