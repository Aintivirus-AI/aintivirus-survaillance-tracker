import { Module } from '@nestjs/common';
import { NominatimGeocoder } from './nominatim.geocoder';

@Module({
  providers: [NominatimGeocoder],
  exports: [NominatimGeocoder],
})
export class GeocodingModule {}


