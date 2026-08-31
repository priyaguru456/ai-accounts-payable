const prisma = require('../../config/prisma');

// AuditLog.userId now has an onDelete: Restrict constraint (see auditLogger.js /
// the audit-chain-integrity migration) — deliberately, so a User with audit history
// can't be hard-deleted and silently corrupt the hash chain. Integration tests that
// create throwaway users must delete those users' audit trail first.
async function cleanupTestUsers(emails) {
  const users = await prisma.user.findMany({ where: { email: { in: emails } } });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return;

  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

module.exports = { cleanupTestUsers };
