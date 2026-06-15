import { Module } from '@nestjs/common';
import { PlanificadorController } from './controllers/planificador.controller';
import { PlanificadorService } from './services/planificador.service';

@Module({
  controllers: [PlanificadorController],
  providers: [PlanificadorService],
})
export class PlanificadorModule {}
