const prisma = require('../config/prisma');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAudit } = require('../utils/auditLogger');

const list = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ users });
});

const update = asyncHandler(async (req, res) => {
  const { role, status } = req.body;
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('User not found');

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { ...(role ? { role } : {}), ...(status ? { status } : {}) },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  await recordAudit({ action: 'USER_UPDATED', entity: 'User', entityId: user.id, userId: req.user.id, metadata: { role, status } });
  res.json({ user });
});

module.exports = { list, update };
