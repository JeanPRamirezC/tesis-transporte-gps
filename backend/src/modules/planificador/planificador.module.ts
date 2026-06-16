import { Module } from '@nestjs/common';
import { PlanificadorController } from './controllers/planificador.controller';
import { PlanificadorService } from './services/planificador.service';
import { EtaModule } from '../eta/eta.module';

@Module({
  imports: [EtaModule],
  controllers: [PlanificadorController],
  providers: [PlanificadorService],
})
export class PlanificadorModule {}
