import { Module } from '@nestjs/common';
import { GtfsController } from './controllers/gtfs.controller';
import { GtfsService } from './services/gtfs.service';
import { VigitrackModule } from '../integrations/vigitrack/vigitrack.module';
import { EtaModule } from '../eta/eta.module';

@Module({
  imports: [VigitrackModule, EtaModule],
  controllers: [GtfsController],
  providers: [GtfsService],
})
export class GtfsModule {}
