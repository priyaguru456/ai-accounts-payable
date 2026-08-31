const prisma = require('../config/prisma');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAudit } = require('../utils/auditLogger');
const { encryptField, decryptField } = require('../utils/fieldEncryption');

function encryptSensitiveFields(data) {
  const out = { ...data };
  if ('bankAccount' in out) out.bankAccount = encryptField(out.bankAccount);
  if ('ifsc' in out) out.ifsc = encryptField(out.ifsc);
  return out;
}

function decryptVendor(vendor) {
  if (!vendor) return vendor;
  return { ...vendor, bankAccount: decryptField(vendor.bankAccount), ifsc: decryptField(vendor.ifsc) };
}

const list = asyncHandler(async (req, res) => {
  const { search, isActive } = req.query;
  const where = {};
  if (search) where.name = { contains: search };
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const vendors = await prisma.vendor.findMany({ where, orderBy: { name: 'asc' } });
  res.json({ vendors: vendors.map(decryptVendor) });
});

const getById = asyncHandler(async (req, res) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: req.params.id },
    include: { invoices: true, purchaseOrders: true },
  });
  if (!vendor) throw ApiError.notFound('Vendor not found');
  res.json({ vendor: decryptVendor(vendor) });
});

const create = asyncHandler(async (req, res) => {
  const vendor = await prisma.vendor.create({ data: encryptSensitiveFields(req.body) });
  await recordAudit({ action: 'VENDOR_CREATED', entity: 'Vendor', entityId: vendor.id, userId: req.user.id });
  res.status(201).json({ vendor: decryptVendor(vendor) });
});

const update = asyncHandler(async (req, res) => {
  const existing = await prisma.vendor.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Vendor not found');

  const vendor = await prisma.vendor.update({ where: { id: req.params.id }, data: encryptSensitiveFields(req.body) });
  await recordAudit({ action: 'VENDOR_UPDATED', entity: 'Vendor', entityId: vendor.id, userId: req.user.id, metadata: { fields: Object.keys(req.body) } });
  res.json({ vendor: decryptVendor(vendor) });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await prisma.vendor.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Vendor not found');

  // Soft-delete only: vendors are referenced by invoices/POs and must be retained for audit history.
  const vendor = await prisma.vendor.update({ where: { id: req.params.id }, data: { isActive: false } });
  await recordAudit({ action: 'VENDOR_DEACTIVATED', entity: 'Vendor', entityId: vendor.id, userId: req.user.id });
  res.json({ vendor: decryptVendor(vendor) });
});

module.exports = { list, getById, create, update, remove };
