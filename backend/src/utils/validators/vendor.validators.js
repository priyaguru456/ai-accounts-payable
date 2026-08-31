const { z } = require('zod');

const createVendorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  gstin: z.string().optional(),
  address: z.string().optional(),
  bankAccount: z.string().optional(),
  ifsc: z.string().optional(),
});

const updateVendorSchema = createVendorSchema.partial().extend({
  isActive: z.boolean().optional(),
});

module.exports = { createVendorSchema, updateVendorSchema };
