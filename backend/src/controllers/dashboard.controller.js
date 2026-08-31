const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

const summary = asyncHandler(async (req, res) => {
  const [statusCounts, totalPayableAgg, overdueCount] = await Promise.all([
    prisma.invoice.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: { status: { in: ['PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED'] } },
    }),
    prisma.invoice.count({
      where: { status: { in: ['PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED'] }, dueDate: { lt: new Date() } },
    }),
  ]);

  res.json({
    statusCounts: statusCounts.map((s) => ({ status: s.status, count: s._count._all })),
    totalPayable: totalPayableAgg._sum.totalAmount || 0,
    overdueCount,
  });
});

const risk = asyncHandler(async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { riskAssessment: { riskLevel: { in: ['HIGH', 'CRITICAL'] } } },
    include: { vendor: true, riskAssessment: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ invoices });
});

module.exports = { summary, risk };
