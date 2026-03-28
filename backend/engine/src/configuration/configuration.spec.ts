import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('NOMINATIM_EMAIL', () => {
    it('throws at startup when NOMINATIM_EMAIL is not set', () => {
      delete process.env.NOMINATIM_EMAIL;
      expect(() => configuration()).toThrow('NOMINATIM_EMAIL');
    });

    it('uses the provided NOMINATIM_EMAIL value', () => {
      process.env.NOMINATIM_EMAIL = 'admin@example.com';
      const config = configuration();
      expect(config.geocoding.nominatim.email).toBe('admin@example.com');
    });

    it('does not fall back to any hardcoded email', () => {
      delete process.env.NOMINATIM_EMAIL;
      let thrown = false;
      try {
        configuration();
      } catch {
        thrown = true;
      }
      expect(thrown).toBe(true);
    });
  });
});
