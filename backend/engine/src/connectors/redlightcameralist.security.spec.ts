import { RedlightCameraListConnector } from './redlightcameralist.connector';

describe('RedlightCameraListConnector — security fixes', () => {
  let instance: any;

  beforeEach(() => {
    instance = new RedlightCameraListConnector() as any;
  });

  describe('normalizeUrl — scheme validation', () => {
    it('rejects javascript: scheme', () => {
      const result = instance.normalizeUrl(
        'https://www.redlightcameralist.com/',
        'javascript:alert(1)',
      );
      expect(result).toBeNull();
    });

    it('rejects data: scheme', () => {
      const result = instance.normalizeUrl(
        'https://www.redlightcameralist.com/',
        'data:text/html,<script>alert(1)</script>',
      );
      expect(result).toBeNull();
    });

    it('accepts https: scheme on the expected host', () => {
      const result = instance.normalizeUrl(
        'https://www.redlightcameralist.com/',
        '/poi/United-States-of-America/Oregon/',
      );
      expect(result).not.toBeNull();
    });
  });

  describe('compileRobotsRule — ReDoS mitigation', () => {
    it('returns a never-matching regex when wildcard count exceeds limit', () => {
      const maliciousRule =
        '/a*b*c*d*e*f*g*h*i*j*k*';
      const regex = instance.compileRobotsRule(maliciousRule);
      expect(regex.test('/anything')).toBe(false);
    });

    it('truncates rules longer than 500 characters', () => {
      const longRule = '/' + 'a'.repeat(600);
      expect(() => instance.compileRobotsRule(longRule)).not.toThrow();
    });

    it('compiles a normal rule correctly', () => {
      const regex = instance.compileRobotsRule('/private/');
      expect(regex.test('/private/')).toBe(true);
      expect(regex.test('/public/')).toBe(false);
    });

    it('compiles a wildcard rule correctly', () => {
      const regex = instance.compileRobotsRule('/poi/*.json$');
      expect(regex.test('/poi/test.json')).toBe(true);
      expect(regex.test('/poi/test.html')).toBe(false);
    });
  });
});
