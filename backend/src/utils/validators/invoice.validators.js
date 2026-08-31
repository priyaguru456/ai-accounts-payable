const { z } = require('zod');

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const uploadInvoiceMetaSchema = z.object({
  vendorId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  purchaseOrderId: z.string().optional(),
  currency: z.string().default('INR'),
  subtotal: z.coerce.number().nonnegative(),
  taxAmount: z.coerce.number().nonnegative(),
  totalAmount: z.coerce.number().nonnegative(),
  items: z
    .string()
    .optional()
    .transform((val) => (val ? JSON.parse(val) : []))
    .pipe(z.array(invoiceItemSchema)),
});

const approvalActionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  comments: z.string().optional(),
});

module.exports = { uploadInvoiceMetaSchema, approvalActionSchema };
