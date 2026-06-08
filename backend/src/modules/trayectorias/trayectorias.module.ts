import { Module } from '@nestjs/common';
import { TrayectoriasController } from './controllers/trayectorias.controller';
import { TrayectoriasService } from './services/trayectorias.service';

@Module({
  controllers: [TrayectoriasController],
  providers: [TrayectoriasService],
  exports: [TrayectoriasService],
})
export class TrayectoriasModule {}