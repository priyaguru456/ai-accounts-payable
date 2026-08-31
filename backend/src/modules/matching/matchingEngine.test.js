jest.mock('../../config/prisma', () => ({
  invoice: { findUnique: jest.fn(), update: jest.fn() },
}));

const prisma = require('../../config/prisma');
const { matchInvoice } = require('./matchingEngine');

describe('matchInvoice', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns NOT_CHECKED when the invoice has no linked purchase order', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ id: 'inv1', totalAmount: 100, items: [], purchaseOrder: null });
    prisma.invoice.update.mockResolvedValue({ id: 'inv1', matchStatus: 'NOT_CHECKED' });

    const result = await matchInvoice('inv1');

    expect(result.matchStatus).toBe('NOT_CHECKED');
    expect(prisma.invoice.update).toHaveBeenCalledWith({ where: { id: 'inv1' }, data: { matchStatus: 'NOT_CHECKED' } });
  });

  it('returns MATCHED when totals are within tolerance and no goods receipts exist (2-way)', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv1',
      totalAmount: 1000,
      items: [{ description: 'Widget', quantity: 10 }],
      purchaseOrder: { totalAmount: 1005, items: [], goodsReceipts: [] },
    });
    prisma.invoice.update.mockResolvedValue({ id: 'inv1', matchStatus: 'MATCHED' });

    const result = await matchInvoice('inv1');

    expect(result.matchStatus).toBe('MATCHED');
    expect(result.details.matchType).toBe('2-way');
  });

  it('returns MISMATCHED when the invoice total deviates from the PO total beyond tolerance', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv1',
      totalAmount: 2000,
      items: [{ description: 'Widget', quantity: 10 }],
      purchaseOrder: { totalAmount: 1000, items: [], goodsReceipts: [] },
    });
    prisma.invoice.update.mockResolvedValue({ id: 'inv1', matchStatus: 'MISMATCHED' });

    const result = await matchInvoice('inv1');

    expect(result.matchStatus).toBe('MISMATCHED');
    expect(result.details.discrepancies).toContainEqual(
      expect.objectContaining({ type: 'AMOUNT_MISMATCH' }),
    );
  });

  it('returns PARTIAL for a 3-way match when goods receipts under-cover invoiced quantities', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv1',
      totalAmount: 1000,
      items: [
        { description: 'Widget', quantity: 10 },
        { description: 'Gadget', quantity: 5 },
      ],
      purchaseOrder: {
        totalAmount: 1000,
        items: [],
        goodsReceipts: [{ items: [{ description: 'Widget', quantity: 10 }] }],
      },
    });
    prisma.invoice.update.mockResolvedValue({ id: 'inv1', matchStatus: 'PARTIAL' });

    const result = await matchInvoice('inv1');

    expect(result.matchStatus).toBe('PARTIAL');
    expect(result.details.matchType).toBe('3-way');
  });
});
