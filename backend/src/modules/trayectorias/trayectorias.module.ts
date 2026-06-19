import { Module } from '@nestjs/common';
import { TrayectoriasController } from './controllers/trayectorias.controller';
import { TrayectoriasService } from './services/trayectorias.service';
import { TiemposTramoModule } from '../tiempos-tramo/tiempos-tramo.module';

@Module({
  imports: [TiemposTramoModule],
  controllers: [TrayectoriasController],
  providers: [TrayectoriasService],
  exports: [TrayectoriasService],
})
export class TrayectoriasModule {}