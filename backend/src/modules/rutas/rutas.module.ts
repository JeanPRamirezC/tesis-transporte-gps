import { Module } from '@nestjs/common';
import { RutasController } from './controllers/rutas.controller';
import { RutasService } from './services/rutas.service';

@Module({
  controllers: [RutasController],
  providers: [RutasService],
})
export class RutasModule {}