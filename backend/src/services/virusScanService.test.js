describe('virusScanService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns clean/unscanned when CLAMAV_HOST is not set (dev default)', async () => {
    delete process.env.CLAMAV_HOST;
    const { scanBuffer } = require('./virusScanService');

    const result = await scanBuffer(Buffer.from('hello'), 'test.pdf');

    expect(result).toEqual({ clean: true, scanned: false });
  });

  it('fails CLOSED (rejects) when CLAMAV_HOST is set but the scanner cannot initialize', async () => {
    process.env.CLAMAV_HOST = 'unreachable-host';
    jest.doMock('clamscan', () =>
      jest.fn().mockImplementation(() => ({
        init: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
      })),
    );

    const { scanBuffer } = require('./virusScanService');
    const result = await scanBuffer(Buffer.from('hello'), 'test.pdf');

    expect(result.clean).toBe(false);
    expect(result.scanned).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('flags an infected file as unclean when the scanner reports it', async () => {
    process.env.CLAMAV_HOST = 'clamav';
    jest.doMock('clamscan', () =>
      jest.fn().mockImplementation(() => ({
        init: jest.fn().mockResolvedValue({
          scanStream: jest.fn().mockResolvedValue({ isInfected: true, viruses: ['Eicar-Test-Signature'] }),
        }),
      })),
    );

    const { scanBuffer } = require('./virusScanService');
    const result = await scanBuffer(Buffer.from('fake-eicar'), 'test.pdf');

    expect(result.clean).toBe(false);
    expect(result.scanned).toBe(true);
    expect(result.viruses).toContain('Eicar-Test-Signature');
  });

  it('passes a genuinely clean file through when the scanner is healthy', async () => {
    process.env.CLAMAV_HOST = 'clamav';
    jest.doMock('clamscan', () =>
      jest.fn().mockImplementation(() => ({
        init: jest.fn().mockResolvedValue({
          scanStream: jest.fn().mockResolvedValue({ isInfected: false, viruses: [] }),
        }),
      })),
    );

    const { scanBuffer } = require('./virusScanService');
    const result = await scanBuffer(Buffer.from('a normal pdf'), 'test.pdf');

    expect(result).toEqual({ clean: true, scanned: true, viruses: [] });
  });
});
