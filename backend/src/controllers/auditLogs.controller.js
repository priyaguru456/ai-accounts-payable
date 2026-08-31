const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { verifyChain } = require('../utils/auditLogger');

const list = asyncHandler(async (req, res) => {
  const { entity, userId, invoiceId, from, to } = req.query;
  const where = {};
  if (entity) where.entity = entity;
  if (userId) where.userId = userId;
  if (invoiceId) where.invoiceId = invoiceId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json({ logs });
});

const verify = asyncHandler(async (req, res) => {
  const result = await verifyChain();
  res.json(result);
});

module.exports = { list, verify };
