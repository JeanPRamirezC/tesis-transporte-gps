import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { VigitrackController } from './controllers/vigitrack.controller';
import { VigitrackSchedulerService } from './services/vigitrack-scheduler.service';
import { VigitrackService } from './services/vigitrack.service';
import { TrayectoriasModule } from '../../trayectorias/trayectorias.module';
import { TiemposTramoModule } from '../../tiempos-tramo/tiempos-tramo.module';
import { EtaModule } from '../../eta/eta.module';
import { ReportesModule } from '../../reportes/reportes.module';

@Module({
  imports: [HttpModule, TrayectoriasModule, TiemposTramoModule, EtaModule, ReportesModule],
  controllers: [VigitrackController],
  providers: [VigitrackService, VigitrackSchedulerService],
})
export class VigitrackModule {}