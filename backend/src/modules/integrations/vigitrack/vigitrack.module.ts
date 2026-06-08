import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { VigitrackController } from './controllers/vigitrack.controller';
import { VigitrackSchedulerService } from './services/vigitrack-scheduler.service';
import { VigitrackService } from './services/vigitrack.service';
import { TrayectoriasModule } from '../../trayectorias/trayectorias.module';
import { TiemposTramoModule } from '../../tiempos-tramo/tiempos-tramo.module';

@Module({
  imports: [HttpModule, TrayectoriasModule, TiemposTramoModule],
  controllers: [VigitrackController],
  providers: [VigitrackService, VigitrackSchedulerService],
})
export class VigitrackModule {}