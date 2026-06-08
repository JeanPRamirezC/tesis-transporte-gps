import { Module } from '@nestjs/common';
import { RutaShapesController } from './controllers/ruta-shapes.controller';
import { RutaShapesService } from './services/ruta-shapes.service';

@Module({
  controllers: [RutaShapesController],
  providers: [RutaShapesService],
})
export class RutaShapesModule {}