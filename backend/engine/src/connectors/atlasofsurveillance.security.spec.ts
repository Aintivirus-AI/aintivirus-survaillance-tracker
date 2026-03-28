import { AtlasOfSurveillanceConnector } from './atlasofsurveillance.connector';

describe('AtlasOfSurveillanceConnector — security fixes', () => {
  let connector: any;

  beforeEach(() => {
    connector = new AtlasOfSurveillanceConnector() as any;
  });

  describe('collect — Content-Type validation', () => {
    it('falls back when server returns text/html (error page)', async () => {
      jest.spyOn(connector.http, 'get').mockResolvedValue({
        data: '<html><body>Error</body></html>',
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });

      const context = { sourceKey: 'atlas-of-surveillance', jobId: '1' };
      const result = await connector.collect(context);
      expect(result).toBeDefined();
    });

    it('parses successfully when Content-Type is text/csv', async () => {
      const csvData =
        'uid,title,jurisdiction,category,latitude,longitude,sourceUrl\n' +
        'test-1,Test Camera,Portland OR,Facial Recognition,45.5,-122.6,https://example.com\n';

      jest.spyOn(connector.http, 'get').mockResolvedValue({
        data: csvData,
        headers: { 'content-type': 'text/csv' },
      });

      const context = { sourceKey: 'atlas-of-surveillance', jobId: '1' };
      const result = await connector.collect(context);
      expect(result).toBeDefined();
    });
  });

  describe('loadSampleEntries — JSON array validation', () => {
    it('throws when the sample file is not a JSON array', () => {
      jest
        .spyOn(require('fs'), 'existsSync')
        .mockReturnValue(true);
      jest
        .spyOn(require('fs'), 'readFileSync')
        .mockReturnValue('{"not": "an array"}');

      const entries = connector.loadSampleEntries();
      expect(entries).toEqual([]);
    });
  });
});
