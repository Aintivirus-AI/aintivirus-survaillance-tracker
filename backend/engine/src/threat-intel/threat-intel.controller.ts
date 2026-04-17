import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ThreatIntelService } from './threat-intel.service';

@Controller('api/threat')
export class ThreatIntelController {
  constructor(private readonly service: ThreatIntelService) {}

  @Get('kev')
  async getKev() {
    try {
      return await this.service.getKev();
    } catch {
      throw new HttpException('KEV feed unavailable', HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('breaches')
  async getBreaches() {
    try {
      return await this.service.getBreaches();
    } catch {
      throw new HttpException('Breach feed unavailable', HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('stalkerware')
  async getStalkerware() {
    try {
      return await this.service.getStalkerware();
    } catch {
      throw new HttpException('Stalkerware feed unavailable', HttpStatus.BAD_GATEWAY);
    }
  }
}
