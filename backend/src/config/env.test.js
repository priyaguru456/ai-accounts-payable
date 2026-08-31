describe('config/env production guard', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, DATABASE_URL: 'mysql://x', JWT_SECRET: 'x' };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('boots fine in production when FIELD_ENCRYPTION_KEY is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.FIELD_ENCRYPTION_KEY = 'a'.repeat(64);
    expect(() => require('./env')).not.toThrow();
  });

  it('refuses to boot in production when FIELD_ENCRYPTION_KEY is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(() => require('./env')).toThrow(/FIELD_ENCRYPTION_KEY is required/);
  });

  it('does not require FIELD_ENCRYPTION_KEY outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(() => require('./env')).not.toThrow();
  });
});
