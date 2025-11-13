import { RedlightCameraListConnector } from './redlightcameralist.connector';

describe('RedlightCameraListConnector', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses a city URL into a config with state abbreviation', () => {
    const connector = new RedlightCameraListConnector();
    const config = (connector as any).parseCityUrl(
      'https://www.redlightcameralist.com/poi/United-States-of-America/Oregon/Portland/',
    );

    expect(config).not.toBeNull();
    expect(config).toMatchObject({
      cityId: 'portland-or',
      jurisdiction: 'Portland, OR',
      url: 'https://www.redlightcameralist.com/poi/United-States-of-America/Oregon/Portland/',
    });
  });

  it('discovers city pages from the index crawl', async () => {
    const connector = new RedlightCameraListConnector();
    const instance = connector as any;

    jest.spyOn(instance, 'delay').mockResolvedValue(undefined);

    const responses: Record<string, string> = {
      'https://www.redlightcameralist.com/robots.txt': 'User-agent: *\nDisallow:\n',
      'https://www.redlightcameralist.com/poi/United-States-of-America/':
        '<a href="/poi/United-States-of-America/Alabama/">Alabama</a>',
      'https://www.redlightcameralist.com/poi/United-States-of-America/Alabama/':
        [
          '<div>',
          '<a href="/poi/United-States-of-America/Alabama/Birmingham/">Birmingham</a>',
          '<a href="https://external.test/">External</a>',
          '</div>',
        ].join(''),
    };

    jest
      .spyOn(instance.http, 'get')
      .mockImplementation((url: string) => {
        const data = responses[url];
        if (data === undefined) {
          return Promise.reject(new Error(`Unexpected discovery URL: ${url}`));
        }
        return Promise.resolve({ data });
      });

    const discovered = await instance.discoverCityConfigs();

    expect(discovered).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cityId: 'birmingham-al',
          jurisdiction: 'Birmingham, AL',
          url: 'https://www.redlightcameralist.com/poi/United-States-of-America/Alabama/Birmingham/',
        }),
      ]),
    );
  });

  it('skips cities that report no listings', () => {
    const connector = new RedlightCameraListConnector();
    const instance = connector as any;

    const result = instance.parseCityHtml(
      '<main><p>No listings at the moment.</p></main>',
      {
        cityId: 'test-city',
        jurisdiction: 'Test City, TS',
        url: 'https://www.redlightcameralist.com/poi/United-States-of-America/Test/Test-City/',
      },
    );

    expect(result).toBeNull();
  });
});

