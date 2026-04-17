import { Module } from '@nestjs/common';
import { ThreatIntelController } from './threat-intel.controller';
import { ThreatIntelService } from './threat-intel.service';

@Module({
  controllers: [ThreatIntelController],
  providers: [ThreatIntelService],
  exports: [ThreatIntelService],
})
export class ThreatIntelModule {}
