describe('notificationService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.EMAIL_SMTP_HOST;
    delete process.env.EMAIL_NOTIFY_TO;
    delete process.env.WEBHOOK_URL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('no-ops (just logs) when no channel is configured', async () => {
    const { notify } = require('./notificationService');
    await expect(notify('INVOICE_APPROVED', { invoiceNumber: 'INV-1' })).resolves.toBeUndefined();
  });

  it('warns and returns for an unknown event type instead of throwing', async () => {
    const { notify } = require('./notificationService');
    await expect(notify('NOT_A_REAL_EVENT', {})).resolves.toBeUndefined();
  });

  it('sends a high-severity event via email when EMAIL_SMTP_HOST and EMAIL_NOTIFY_TO are set', async () => {
    process.env.EMAIL_SMTP_HOST = 'smtp.example.com';
    process.env.EMAIL_NOTIFY_TO = 'security@example.com';

    const sendMail = jest.fn().mockResolvedValue(true);
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn().mockReturnValue({ sendMail }),
    }));

    const { notify } = require('./notificationService');
    await notify('VENDOR_BANK_DETAILS_CHANGED', { vendorId: 'v1', vendorName: 'Acme Corp' });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const [call] = sendMail.mock.calls[0];
    expect(call.to).toBe('security@example.com');
    expect(call.text).toContain('Acme Corp');
  });

  it('does NOT email a routine (non-high-severity) event even when email is configured', async () => {
    process.env.EMAIL_SMTP_HOST = 'smtp.example.com';
    process.env.EMAIL_NOTIFY_TO = 'security@example.com';

    const sendMail = jest.fn().mockResolvedValue(true);
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn().mockReturnValue({ sendMail }),
    }));

    const { notify } = require('./notificationService');
    await notify('INVOICE_APPROVED', { invoiceNumber: 'INV-1' });

    expect(sendMail).not.toHaveBeenCalled();
  });

  it('POSTs every event to WEBHOOK_URL when configured', async () => {
    process.env.WEBHOOK_URL = 'https://erp.example.com/hooks/ap';

    const post = jest.fn().mockResolvedValue({ status: 200 });
    jest.doMock('axios', () => ({ post }));

    const { notify } = require('./notificationService');
    await notify('PAYMENT_COMPLETED', { invoiceNumber: 'INV-1', amount: '100.00' });

    expect(post).toHaveBeenCalledWith(
      'https://erp.example.com/hooks/ap',
      expect.objectContaining({ event: 'PAYMENT_COMPLETED' }),
    );
  });

  it('does not throw when the email transport rejects', async () => {
    process.env.EMAIL_SMTP_HOST = 'smtp.example.com';
    process.env.EMAIL_NOTIFY_TO = 'security@example.com';

    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn().mockReturnValue({ sendMail: jest.fn().mockRejectedValue(new Error('smtp down')) }),
    }));

    const { notify } = require('./notificationService');
    await expect(notify('AUDIT_CHAIN_BROKEN', { brokenAt: 'abc123' })).resolves.toBeUndefined();
  });
});
