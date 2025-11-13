import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';

export interface ReverseGeocodeParams {
  latitude: number;
  longitude: number;
  zoom?: number;
}

export interface ReverseGeocodeResult {
  formattedAddress?: string;
  houseNumber?: string;
  road?: string;
  neighbourhood?: string;
  city?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countryCode?: string;
}

interface NominatimReverseResponse {
  display_name?: string;
  address?: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
  error?: string;
}

const DEFAULT_BASE_URL = 'https://nominatim.openstreetmap.org';
const DEFAULT_USER_AGENT = 'aintivirus-surveillance-tracker/1.0';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RATE_LIMIT_MS = 1100;

@Injectable()
export class NominatimGeocoder {
  private readonly logger = new Logger(NominatimGeocoder.name);
  private readonly http: AxiosInstance;
  private readonly rateLimitMs: number;
  private lastRequestAt = 0;

  constructor(private readonly configService: ConfigService) {
    const baseURL =
      this.configService.get<string>('geocoding.nominatim.baseUrl') ??
      DEFAULT_BASE_URL;
    const userAgent =
      this.configService.get<string>('geocoding.nominatim.userAgent') ??
      DEFAULT_USER_AGENT;
    const email = this.configService.get<string>('geocoding.nominatim.email');
    const timeout =
      this.configService.get<number>('geocoding.nominatim.timeoutMs') ??
      DEFAULT_TIMEOUT_MS;
    this.rateLimitMs =
      this.configService.get<number>('geocoding.nominatim.rateLimitMs') ??
      DEFAULT_RATE_LIMIT_MS;

    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      Accept: 'application/json',
    };

    if (email) {
      headers.From = email;
    }

    this.http = axios.create({
      baseURL,
      timeout,
      headers,
    });
  }

  async reverseGeocode(
    params: ReverseGeocodeParams,
  ): Promise<ReverseGeocodeResult | undefined> {
    const { latitude, longitude, zoom } = params;
    await this.respectRateLimit();

    try {
      const response = await this.http.get<NominatimReverseResponse>('/reverse', {
        params: {
          format: 'jsonv2',
          lat: latitude,
          lon: longitude,
          zoom: zoom ?? 18,
          addressdetails: 1,
          extratags: 0,
          namedetails: 0,
          accept_language: 'en',
        },
      });

      if (response.data?.error) {
        this.logger.debug(
          `Nominatim reverse geocoding returned error: ${response.data.error}`,
        );
        return undefined;
      }

      if (!response.data?.address) {
        this.logger.debug(
          'Nominatim reverse geocoding response missing address details.',
        );
        return undefined;
      }

      const address = response.data.address;

      return {
        formattedAddress: response.data.display_name,
        houseNumber: address.house_number,
        road: address.road,
        neighbourhood:
          address.neighbourhood ??
          address.suburb ??
          address.city_district ??
          address.county,
        city: address.city ?? address.town ?? address.village,
        county: address.county,
        state: address.state,
        postcode: address.postcode,
        country: address.country,
        countryCode: address.country_code
          ? address.country_code.toUpperCase()
          : undefined,
      };
    } catch (error) {
      this.handleError(error, latitude, longitude);
      return undefined;
    }
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < this.rateLimitMs) {
      const waitMs = this.rateLimitMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastRequestAt = Date.now();
  }

  private handleError(
    error: unknown,
    latitude: number,
    longitude: number,
  ): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string }>;
      const status = axiosError.response?.status;
      const statusText = axiosError.response?.statusText;
      const nominatimError = axiosError.response?.data?.error;
      this.logger.warn(
        `Nominatim reverse geocoding failed for (${latitude}, ${longitude})` +
          (status ? ` [${status} ${statusText ?? ''}]` : '') +
          (nominatimError ? `: ${nominatimError}` : ''),
      );
    } else if (error instanceof Error) {
      this.logger.warn(
        `Nominatim reverse geocoding failed for (${latitude}, ${longitude}): ${error.message}`,
      );
    } else {
      this.logger.warn(
        `Nominatim reverse geocoding failed for (${latitude}, ${longitude}): ${String(
          error,
        )}`,
      );
    }
  }
}


