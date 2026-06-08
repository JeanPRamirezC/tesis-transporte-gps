import { Module } from '@nestjs/common';
import { EtaModule } from '../eta/eta.module';
import { MapaController } from './controllers/mapa.controller';
import { MapaService } from './services/mapa.service';

@Module({
  imports: [EtaModule],
  controllers: [MapaController],
  providers: [MapaService],
})
export class MapaModule {}