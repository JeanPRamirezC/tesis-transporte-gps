import { Module } from '@nestjs/common';
import { MetricasController } from './controllers/metricas.controller';
import { MetricasService } from './services/metricas.service';

@Module({
  controllers: [MetricasController],
  providers: [MetricasService],
  exports: [MetricasService],
})
export class MetricasModule {}
