import { OverpassConnector } from './overpass.connector';
import type { NominatimGeocoder } from '../geocoding/nominatim.geocoder';

describe('OverpassConnector', () => {
  const createConnector = (impl?: {
    reverseGeocode?: ReturnType<typeof jest.fn>;
  }) => {
    const geocoder: NominatimGeocoder = {
      reverseGeocode: impl?.reverseGeocode ?? jest.fn().mockResolvedValue(undefined),
    } as unknown as NominatimGeocoder;

    const connector = new OverpassConnector(geocoder);
    return { connector: connector as any, geocoder };
  };

  it('normalizes an Overpass node into a dataset record', async () => {
    const reverseGeocode = jest.fn();
    const { connector } = createConnector({ reverseGeocode });

    const record = await connector.toRecord({
      id: 123,
      lat: 37.7749,
      lon: -122.4194,
      tags: {
        name: 'Downtown ALPR',
        'addr:city': 'San Francisco',
        'addr:state': 'CA',
        operator: 'SFPD',
      },
    });

    expect(reverseGeocode).not.toHaveBeenCalled();
    expect(record).toMatchObject({
      uid: 'overpass-alpr-123',
      jurisdiction: 'San Francisco, CA',
      address: 'Downtown ALPR',
      category: 'license_plate_reader',
      latitude: 37.7749,
      longitude: -122.4194,
      raw: expect.objectContaining({
        id: 123,
        sourceUrl: 'https://www.openstreetmap.org/node/123',
      }),
    });
  });

  it('extracts only valid nodes from an Overpass response', () => {
    const { connector } = createConnector();

    const nodes = connector.extractNodes({
      elements: [
        { type: 'node', id: 1, lat: 10, lon: 20 },
        { type: 'way', id: 2, lat: 30, lon: 40 },
        { type: 'node', id: 3, lat: NaN, lon: 40 },
        { type: 'node', id: 4, lat: 15, lon: -5, tags: { name: 'Valid' } },
      ],
    });

    expect(nodes).toEqual([
      { id: 1, lat: 10, lon: 20, tags: undefined },
      { id: 4, lat: 15, lon: -5, tags: { name: 'Valid' } },
    ]);
  });

  it('reverse geocodes nodes missing jurisdictional metadata', async () => {
    const reverseGeocode = jest.fn().mockResolvedValue({
      formattedAddress: '123 Example St, Example City, CA 99999, USA',
      houseNumber: '123',
      road: 'Example St',
      city: 'Example City',
      state: 'CA',
      country: 'United States',
      postcode: '99999',
    });
    const { connector } = createConnector({ reverseGeocode });

    const record = await connector.toRecord({
      id: 456,
      lat: 40.7128,
      lon: -74.006,
      tags: {
        operator: 'Example PD',
      },
    });

    expect(reverseGeocode).toHaveBeenCalledWith({
      latitude: 40.7128,
      longitude: -74.006,
    });
    expect(record).toMatchObject({
      jurisdiction: 'Example City, CA',
      address: '123 Example St, Example City, CA 99999, USA',
      raw: expect.objectContaining({
        reverseGeocode: expect.objectContaining({
          formattedAddress: '123 Example St, Example City, CA 99999, USA',
        }),
      }),
    });
  });
});


