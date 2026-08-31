const prisma = require('../config/prisma');
const { recordAudit, verifyChain } = require('./auditLogger');

describe('auditLogger hash chain (integration)', () => {
  let userId;
  const email = `audit-test-${Date.now()}@example.com`;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email, passwordHash: 'x', name: 'Audit Test User' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('verifyChain reports valid for a clean, untampered sequence of writes', async () => {
    await recordAudit({ action: 'TEST_ACTION_1', entity: 'Test', entityId: 'a', userId });
    await recordAudit({ action: 'TEST_ACTION_2', entity: 'Test', entityId: 'b', userId });

    const result = await verifyChain();
    expect(result.valid).toBe(true);
  });

  it('verifyChain detects a directly-tampered row', async () => {
    const log = await recordAudit({ action: 'TEST_ACTION_3', entity: 'Test', entityId: 'c', userId });

    // Simulate out-of-band tampering: edit the action field without going through
    // recordAudit (which would recompute the hash correctly).
    await prisma.auditLog.update({ where: { id: log.id }, data: { action: 'TAMPERED_ACTION' } });

    const result = await verifyChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(log.id);

    // Restore so afterAll's cleanup and any later test run isn't left in a broken state.
    await prisma.auditLog.update({ where: { id: log.id }, data: { action: 'TEST_ACTION_3' } });
  });

  it('the DB refuses to delete a User referenced by an AuditLog row (prevents silent hash corruption)', async () => {
    await recordAudit({ action: 'TEST_ACTION_4', entity: 'Test', entityId: 'd', userId });

    await expect(prisma.user.delete({ where: { id: userId } })).rejects.toThrow();

    // The chain must still be intact — the failed delete must not have partially
    // mutated anything.
    const result = await verifyChain();
    expect(result.valid).toBe(true);
  });
});
