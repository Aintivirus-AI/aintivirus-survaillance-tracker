describe('validateCorsOrigins', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function buildValidator(nodeEnv: string) {
    process.env.NODE_ENV = nodeEnv;
    const isDev = nodeEnv === 'development';
    return function validateCorsOrigins(raw: string[]): string[] {
      return raw.filter((origin) => {
        try {
          const url = new URL(origin);
          if (!isDev && url.protocol !== 'https:') {
            return false;
          }
          return true;
        } catch {
          return false;
        }
      });
    };
  }

  it('rejects http:// origins in production', () => {
    const validate = buildValidator('production');
    const result = validate(['http://evil.example.com']);
    expect(result).toHaveLength(0);
  });

  it('rejects malformed origins', () => {
    const validate = buildValidator('production');
    const result = validate(['not-a-url', '   ']);
    expect(result).toHaveLength(0);
  });

  it('accepts https:// origins in production', () => {
    const validate = buildValidator('production');
    const result = validate(['https://app.example.com']);
    expect(result).toEqual(['https://app.example.com']);
  });

  it('allows http:// origins in development', () => {
    const validate = buildValidator('development');
    const result = validate(['http://localhost:5173']);
    expect(result).toEqual(['http://localhost:5173']);
  });

  it('filters mixed valid/invalid list', () => {
    const validate = buildValidator('production');
    const result = validate([
      'https://good.example.com',
      'http://bad.example.com',
      'not-a-url',
    ]);
    expect(result).toEqual(['https://good.example.com']);
  });
});
