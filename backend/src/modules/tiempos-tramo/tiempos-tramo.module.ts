import { Module } from '@nestjs/common';
import { TiemposTramoController } from './controllers/tiempos-tramo.controller';
import { TiemposTramoService } from './services/tiempos-tramo.service';

@Module({
  controllers: [TiemposTramoController],
  providers: [TiemposTramoService],
  exports: [TiemposTramoService],
})
export class TiemposTramoModule {}